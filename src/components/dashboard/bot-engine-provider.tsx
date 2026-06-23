'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { bridgeAnalyze, bridgeTrade, getBridgeUrl, fetchWithTimeout } from '@/lib/bridge';
import { playInvestSound, playWinSound, playLossSound } from '@/lib/sounds';

export type LogEntry = {
  id: string;
  timestamp: Date;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
};

export type AnalysisState = {
  direction: 'CALL' | 'PUT' | 'NONE';
  probability: number;
  rsi?: number;
  candles?: any[];
  lastUpdated: Date;
};

interface BotEngineContextValue {
  logs: LogEntry[];
  analyses: Record<string, AnalysisState>;
  isRunning: boolean;
  bridgeOnline: boolean | null;
  toggleEngine: () => void;
  activePairs: string[];
  clearLogs: () => void;
}

const BotEngineContext = createContext<BotEngineContextValue | null>(null);

export const useBotEngine = () => {
  const ctx = useContext(BotEngineContext);
  if (!ctx) throw new Error('useBotEngine must be used within BotEngineProvider');
  return ctx;
};

export function BotEngineProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [isRunning, setIsRunning] = useState(true);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);

  // ─── Refs para que el loop siempre lea el último valor sin reiniciarse ───
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const isRunningRef = useRef(true);
  const bridgeOnlineRef = useRef<boolean | null>(null);
  const brokerConfigRef = useRef<any>(null);
  const botParamsRef2 = useRef<any>(null);
  const recentTradesRef = useRef<any[]>([]);
  const userRef = useRef(user);
  const firestoreRef = useRef(firestore);

  // Sincronizar refs con el estado/props más recientes
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { bridgeOnlineRef.current = bridgeOnline; }, [bridgeOnline]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { firestoreRef.current = firestore; }, [firestore]);

  // Firestore Refs
  const brokerDocRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const botParamsDocRef = firestore ? doc(firestore, 'configuracion', 'bot_params') : null;

  const { data: brokerConfig } = useDoc(brokerDocRef);
  const { data: botParams } = useDoc(botParamsDocRef);

  const currentAccountType = brokerConfig?.accountType || 'demo';

  // Trades para verificar pérdidas recientes (para Martingala y Guardian)
  const tradesQuery = user && firestore
    ? query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(5))
    : null;
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = recentTradesRaw?.filter((t: any) => t.accountType === currentAccountType) || [];

  // Mantener refs actualizadas con Firestore data
  useEffect(() => { brokerConfigRef.current = brokerConfig; }, [brokerConfig]);
  useEffect(() => { botParamsRef2.current = botParams; }, [botParams]);
  useEffect(() => { recentTradesRef.current = recentTrades; }, [recentTrades]);

  const addLog = useCallback((source: string, message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const newLogs = [{ id: Math.random().toString(36).substring(7), timestamp: new Date(), source, message, type }, ...prev];
      return newLogs.slice(0, 200);
    });
  }, []);

  const clearLogs = () => setLogs([]);
  const toggleEngine = () => setIsRunning(prev => !prev);

  useEffect(() => { setMounted(true); }, []);

  // Health check del puente — loop independiente, no afecta al engine loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const checkBridge = async () => {
      try {
        const res = await fetchWithTimeout(`${getBridgeUrl()}/health`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }, 5000);
        setBridgeOnline(res.ok);
      } catch {
        setBridgeOnline(false);
      }
    };
    checkBridge();
    interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const calculateAmount = useCallback((balance: number): number => {
    const params = botParamsRef2.current;
    if (!params) return 10;
    const mode = params.moneyManagementMode || 'fixed';
    const base = params.investmentPerTrade || 500;
    if (mode === 'fixed') return base;
    if (mode === 'compound') {
      const percent = params.compoundPercentage || 5;
      const amt = Math.floor(balance * (percent / 100));
      return amt < 1 ? 1 : amt;
    }
    if (mode === 'martingale') {
      const multiplier = params.martingaleMultiplier || 2.1;
      const lastTrade = recentTradesRef.current[0] ?? null;
      if (lastTrade && lastTrade.status === 'loss') {
        return Math.floor((lastTrade.amount || base) * multiplier);
      }
      return base;
    }
    return base;
  }, []);

  const runGuardianCheck = useCallback((balance: number, proposedAmount: number): boolean => {
    if (balance > 0 && balance < proposedAmount) {
      addLog('SISTEMA', `Saldo insuficiente ($${balance} < requerido $${proposedAmount})`, 'warning');
      return false;
    }
    const params = botParamsRef2.current;
    const maxLosses = params?.maxLosses ?? 3;
    const trades = recentTradesRef.current;
    const currentLosingStreak = trades.slice(0, maxLosses).every((t: any) => t.status === 'loss');
    if (currentLosingStreak && trades.length >= maxLosses) {
      addLog('SISTEMA', `Pausa de seguridad: ${maxLosses} pérdidas consecutivas.`, 'error');
      setIsRunning(false);
      return false;
    }
    return true;
  }, [addLog]);

  // ─── ENGINE LOOP — solo se inicia UNA VEZ por sesión ─────────────────────
  const engineLoop = useCallback(async () => {
    // Leer SIEMPRE desde refs, no desde closure
    const config = brokerConfigRef.current;
    const params = botParamsRef2.current;
    const isBridgeOnline = bridgeOnlineRef.current;
    const running = isRunningRef.current;
    const currentUser = userRef.current;
    const currentFirestore = firestoreRef.current;
    const accountType = config?.accountType || 'demo';

    if (!isBridgeOnline || !config?.email || !config?.password || isExecutingRef.current) {
      loopTimeoutRef.current = setTimeout(engineLoop, 3000);
      return;
    }

    const pairs: string[] = (params?.pairs && Array.isArray(params.pairs) && params.pairs.length > 0)
      ? params.pairs
      : ['EURUSD-OTC'];

    const minConfidence = params?.min_confidence_score ?? 85;

    for (const pair of pairs) {
      try {
        const result = await bridgeAnalyze({
          email: config.email,
          password: config.password,
          pair,
          accountType,
          minRsi: 30,
          maxRsi: 70
        });

        if (!result.success) {
          addLog('BRIDGE', `Fallo analizando ${pair}: ${result.error}`, 'error');
          continue;
        }

        const { direction, probability, rsi, candles, balance } = result;

        setAnalyses(prev => ({
          ...prev,
          [pair]: { direction, probability, rsi, candles, lastUpdated: new Date() }
        }));

        addLog('SISTEMA', `Análisis ${pair} - RSI: ${rsi}`, 'info');

        if (direction !== 'NONE' && probability >= minConfidence) {
          addLog('QUANTUM-X', `Señal ${direction} en ${pair} - precisión ${probability.toFixed(0)}%`, 'success');

          if (!isRunningRef.current) {
            addLog('SISTEMA', `Señal en ${pair} omitida porque el MOTOR ESTÁ PAUSADO.`, 'warning');
            continue;
          }

          if (isExecutingRef.current) {
            addLog('SISTEMA', `Ignorando señal en ${pair} porque hay otra operación en curso.`, 'warning');
            continue;
          }

          const amount = calculateAmount(balance || 0);
          if (!runGuardianCheck(balance || 0, amount)) continue;

          isExecutingRef.current = true;
          addLog('V7-MAESTRO', `EJECUTANDO ORDEN ${direction} POR $${amount} EN ${pair}...`, 'warning');
          playInvestSound();

          const tradeResult = await bridgeTrade({
            email: config.email,
            password: config.password,
            pair,
            direction,
            amount,
            accountType
          });

          if (tradeResult.success && currentUser && currentFirestore) {
            const timestamp = new Date().toISOString();
            const { profit, status } = tradeResult;

            await addDoc(collection(currentFirestore, 'users', currentUser.uid, 'trades'), {
              pair, direction, amount, status, profit,
              orderId: tradeResult.orderId,
              timestamp, accountType,
              broker: 'IQ Option',
            });

            const statsRef = doc(currentFirestore, 'users', currentUser.uid, 'trading_stats', accountType);
            const statsSnap = await getDoc(statsRef);
            const currentStats = statsSnap.data() || {
              balance: tradeResult.balance, totalTrades: 0, winRate: 0, wins: 0, losses: 0, dailyProfit: 0
            };

            const isWin = status === 'win';
            const isLoss = status === 'loss';
            const newWins = (currentStats.wins || 0) + (isWin ? 1 : 0);
            const newLosses = (currentStats.losses || 0) + (isLoss ? 1 : 0);
            const newTotal = (currentStats.totalTrades || 0) + 1;
            const newWinRate = Math.round((newWins / newTotal) * 100);
            const newDailyProfit = (currentStats.dailyProfit || 0) + (profit ?? 0);

            await setDoc(statsRef, {
              balance: tradeResult.balance,
              totalTrades: newTotal,
              wins: newWins,
              losses: newLosses,
              winRate: newWinRate,
              dailyProfit: newDailyProfit,
              lastUpdate: timestamp,
            }, { merge: true });

            if (isWin) playWinSound();
            else if (isLoss) playLossSound();

            addLog('SISTEMA', `Operación finalizada: ${status!.toUpperCase()} | Beneficio: $${profit}`, isWin ? 'success' : 'error');
          } else {
            addLog('SISTEMA', `Fallo al ejecutar orden: ${tradeResult.error}`, 'error');
          }

          isExecutingRef.current = false;
        }

      } catch (err: any) {
        if (!err.message?.includes('The user aborted a request')) {
          addLog('SISTEMA', `Fallo en conexión HTTP o error de código: ${err.message}`, 'error');
        }
        isExecutingRef.current = false;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    loopTimeoutRef.current = setTimeout(engineLoop, 2000);
  }, [addLog, calculateAmount, runGuardianCheck]);

  // ─── Arrancar el loop UNA SOLA VEZ cuando el usuario esté listo ──────────
  useEffect(() => {
    if (!mounted || !user) return;
    // Pequeña espera para que Firestore cargue los datos antes de arrancar
    const startDelay = setTimeout(() => {
      engineLoop();
    }, 2000);
    return () => {
      clearTimeout(startDelay);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  // Solo depende de mounted y user — los datos se leen por refs
  }, [mounted, user, engineLoop]);

  return (
    <BotEngineContext.Provider value={{
      logs,
      analyses,
      isRunning,
      bridgeOnline,
      toggleEngine,
      clearLogs,
      activePairs: (botParams?.pairs && Array.isArray(botParams.pairs)) ? botParams.pairs : ['EURUSD-OTC']
    }}>
      {children}
    </BotEngineContext.Provider>
  );
}
