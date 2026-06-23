'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { bridgeAnalyze, bridgeTrade, getBridgeUrl, fetchWithTimeout } from '@/lib/bridge';
import { playInvestSound, playWinSound, playLossSound } from '@/lib/sounds';
import { getActivePairs, getMarketStatus, type MarketStatus } from '@/lib/market-schedule';

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
  marketStatus: MarketStatus | null;
}

const BotEngineContext = createContext<BotEngineContextValue | null>(null);

export const useBotEngine = () => {
  const ctx = useContext(BotEngineContext);
  if (!ctx) throw new Error('useBotEngine must be used within BotEngineProvider');
  return ctx;
};

const DEFAULT_AUTOPILOT = {
  enabled: false,
  autoConnectBridge: true,
  pairMode: 'manual' as const,
  scheduleMode: 'auto' as const,
  slots: [],
};

export function BotEngineProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [isRunning, setIsRunning] = useState(true);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);

  // ─── Refs para que el loop lea siempre el valor más reciente sin reiniciarse ──
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const isRunningRef = useRef(true);
  const bridgeOnlineRef = useRef<boolean | null>(null);
  const brokerConfigRef = useRef<any>(null);
  const botParamsRef2 = useRef<any>(null);
  const recentTradesRef = useRef<any[]>([]);
  const userRef = useRef(user);
  const firestoreRef = useRef(firestore);
  const lastScheduleLogRef = useRef<number>(0); // Para no spamear logs de "fuera de horario"

  // Sincronizar refs
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { bridgeOnlineRef.current = bridgeOnline; }, [bridgeOnline]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { firestoreRef.current = firestore; }, [firestore]);

  // Firestore listeners
  const brokerDocRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const botParamsDocRef = firestore ? doc(firestore, 'configuracion', 'bot_params') : null;

  const { data: brokerConfig } = useDoc(brokerDocRef);
  const { data: botParams } = useDoc(botParamsDocRef);

  const currentAccountType = brokerConfig?.accountType || 'demo';

  const tradesQuery = user && firestore
    ? query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(5))
    : null;
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = recentTradesRaw?.filter((t: any) => t.accountType === currentAccountType) || [];

  // Mantener refs actualizadas
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

  // Health check del puente — loop independiente
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

  // ─── ENGINE LOOP — corre UNA sola vez, lee todo desde refs ───────────────────
  const engineLoop = useCallback(async () => {
    const config = brokerConfigRef.current;
    const params = botParamsRef2.current;
    const isBridgeOnline = bridgeOnlineRef.current;
    const currentUser = userRef.current;
    const currentFirestore = firestoreRef.current;
    const accountType = config?.accountType || 'demo';

    // ── 1. Determinar pares activos (AutoPilot o manual) ──
    const autopilot = params?.autopilot ?? DEFAULT_AUTOPILOT;
    const regularPairs: string[] = params?.regularPairs ?? ['EURUSD', 'GBPUSD', 'USDJPY'];
    const otcPairs: string[] = params?.otcPairs ?? ['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC'];
    const manualPairs: string[] = (params?.pairs && Array.isArray(params.pairs)) ? params.pairs : ['EURUSD-OTC'];

    const { pairs: activePairs, reason } = getActivePairs(autopilot, regularPairs, otcPairs, manualPairs);

    // Actualizar estado del mercado para la UI
    const status = getMarketStatus(autopilot, regularPairs, otcPairs, manualPairs);
    setMarketStatus(status);

    // ── 2. Si fuera de horario programado, esperar ──
    if (autopilot.enabled && autopilot.scheduleMode === 'custom' && activePairs.length === 0) {
      const now = Date.now();
      // Log solo cada 5 minutos para no spamear
      if (now - lastScheduleLogRef.current > 5 * 60 * 1000) {
        addLog('AUTOPILOT', `Fuera de horario. ${status.sublabel}`, 'warning');
        lastScheduleLogRef.current = now;
      }
      loopTimeoutRef.current = setTimeout(engineLoop, 60000); // revisar cada minuto
      return;
    }

    // ── 3. Verificar que el puente y las credenciales estén disponibles ──
    if (!isBridgeOnline || !config?.email || !config?.password || isExecutingRef.current) {
      loopTimeoutRef.current = setTimeout(engineLoop, 3000);
      return;
    }

    const minConfidence = params?.min_confidence_score ?? 85;
    const pairs = activePairs.length > 0 ? activePairs : manualPairs;

    // ── 4. Analizar cada par ──
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
          // Si el activo no se encuentra (fuera de mercado), saltar silenciosamente
          const isNotFound = result.error?.toLowerCase().includes('not found') ||
                             result.error?.toLowerCase().includes('no encontrado');
          if (!isNotFound) {
            addLog('BRIDGE', `Fallo analizando ${pair}: ${result.error}`, 'error');
          }
          continue;
        }

        const { direction, probability, rsi, candles, balance } = result;

        setAnalyses(prev => ({
          ...prev,
          [pair]: { direction, probability, rsi, candles, lastUpdated: new Date() }
        }));

        addLog('SISTEMA', `${pair} — RSI: ${rsi} | ${direction} (${probability.toFixed(0)}%)`, 'info');

        if (direction !== 'NONE' && probability >= minConfidence) {
          addLog('QUANTUM-X', `Señal ${direction} en ${pair} — precisión ${probability.toFixed(0)}%`, 'success');

          if (!isRunningRef.current) {
            addLog('SISTEMA', `Señal en ${pair} omitida: motor pausado.`, 'warning');
            continue;
          }

          if (isExecutingRef.current) {
            addLog('SISTEMA', `Ignorando señal en ${pair}: operación en curso.`, 'warning');
            continue;
          }

          const amount = calculateAmount(balance || 0);
          if (!runGuardianCheck(balance || 0, amount)) continue;

          isExecutingRef.current = true;
          addLog('V7-MAESTRO', `EJECUTANDO ${direction} $${amount} en ${pair}...`, 'warning');
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
            const { profit, status: tradeStatus } = tradeResult;

            await addDoc(collection(currentFirestore, 'users', currentUser.uid, 'trades'), {
              pair, direction, amount,
              status: tradeStatus, profit,
              orderId: tradeResult.orderId,
              timestamp, accountType,
              broker: 'IQ Option',
            });

            const statsRef = doc(currentFirestore, 'users', currentUser.uid, 'trading_stats', accountType);
            const statsSnap = await getDoc(statsRef);
            const currentStats = statsSnap.data() || {
              balance: tradeResult.balance, totalTrades: 0, winRate: 0, wins: 0, losses: 0, dailyProfit: 0
            };

            const isWin = tradeStatus === 'win';
            const isLoss = tradeStatus === 'loss';
            const newWins = (currentStats.wins || 0) + (isWin ? 1 : 0);
            const newLosses = (currentStats.losses || 0) + (isLoss ? 1 : 0);
            const newTotal = (currentStats.totalTrades || 0) + 1;

            await setDoc(statsRef, {
              balance: tradeResult.balance,
              totalTrades: newTotal,
              wins: newWins,
              losses: newLosses,
              winRate: Math.round((newWins / newTotal) * 100),
              dailyProfit: (currentStats.dailyProfit || 0) + (profit ?? 0),
              lastUpdate: timestamp,
            }, { merge: true });

            if (isWin) playWinSound();
            else if (isLoss) playLossSound();

            addLog('SISTEMA', `Resultado: ${tradeStatus!.toUpperCase()} | $${profit}`, isWin ? 'success' : 'error');
          } else {
            addLog('SISTEMA', `Fallo al ejecutar: ${tradeResult.error}`, 'error');
          }

          isExecutingRef.current = false;
        }

      } catch (err: any) {
        if (!err.message?.includes('The user aborted a request')) {
          addLog('SISTEMA', `Error: ${err.message}`, 'error');
        }
        isExecutingRef.current = false;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    loopTimeoutRef.current = setTimeout(engineLoop, 2000);
  }, [addLog, calculateAmount, runGuardianCheck]);

  // ─── Arrancar el loop UNA SOLA VEZ ───────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !user) return;
    const startDelay = setTimeout(() => {
      engineLoop();
    }, 2000);
    return () => {
      clearTimeout(startDelay);
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  }, [mounted, user, engineLoop]);

  // Calcular pares activos para la UI
  const params = botParams;
  const autopilot = params?.autopilot ?? DEFAULT_AUTOPILOT;
  const { pairs: uiPairs } = getActivePairs(
    autopilot,
    params?.regularPairs ?? ['EURUSD', 'GBPUSD'],
    params?.otcPairs ?? ['EURUSD-OTC', 'GBPUSD-OTC'],
    (params?.pairs && Array.isArray(params.pairs)) ? params.pairs : ['EURUSD-OTC']
  );

  return (
    <BotEngineContext.Provider value={{
      logs,
      analyses,
      isRunning,
      bridgeOnline,
      toggleEngine,
      clearLogs,
      activePairs: uiPairs.length > 0 ? uiPairs : (params?.pairs ?? ['EURUSD-OTC']),
      marketStatus,
    }}>
      {children}
    </BotEngineContext.Provider>
  );
}
