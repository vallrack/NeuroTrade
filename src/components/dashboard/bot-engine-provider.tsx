'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, getDoc, setDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { bridgeAnalyze, bridgeTrade, getBridgeUrl, fetchWithTimeout, type AnalyzeResponse } from '@/lib/bridge';
import { playSuccessChime, playAlarm, playInvestSound, playWinSound, playLossSound } from '@/lib/sounds';

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
  const [isRunning, setIsRunning] = useState(false);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);

  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  // Firestore Refs
  const brokerRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const botParamsRef = firestore ? doc(firestore, 'configuracion', 'bot_params') : null;

  const { data: brokerConfig } = useDoc(brokerRef);
  const { data: botParams } = useDoc(botParamsRef);

  const currentAccountType = brokerConfig?.accountType || 'demo';
  
  // Trades para verificar pérdidas recientes (para Martingala y Guardian)
  const tradesQuery = user && firestore 
    ? query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(5)) 
    : null;
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = recentTradesRaw?.filter((t: any) => t.accountType === currentAccountType) || [];

  const addLog = useCallback((source: string, message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const newLogs = [{ id: Math.random().toString(36).substring(7), timestamp: new Date(), source, message, type }, ...prev];
      return newLogs.slice(0, 200); // Mantener max 200 logs en memoria
    });
  }, []);

  const clearLogs = () => setLogs([]);
  const toggleEngine = () => setIsRunning(prev => !prev);

  useEffect(() => { setMounted(true); }, []);

  // Health check del puente
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const checkBridge = async () => {
      try {
        const res = await fetchWithTimeout(`${getBridgeUrl()}/health`, {}, 5000);
        setBridgeOnline(res.ok);
      } catch {
        setBridgeOnline(false);
      }
    };
    checkBridge();
    interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const calculateAmount = (balance: number): number => {
    if (!botParams) return 10;
    
    const mode = botParams.moneyManagementMode || 'fixed';
    const base = botParams.investmentPerTrade || 500;

    if (mode === 'fixed') return base;
    
    if (mode === 'compound') {
      const percent = botParams.compoundPercentage || 5;
      const amt = Math.floor(balance * (percent / 100));
      return amt < 1 ? 1 : amt; // mínimo 1$ (o 1 COP)
    }
    
    if (mode === 'martingale') {
      const multiplier = botParams.martingaleMultiplier || 2.1;
      const lastTrade = recentTrades.length > 0 ? recentTrades[0] : null;
      if (lastTrade && lastTrade.status === 'loss') {
        const prevAmount = lastTrade.amount || base;
        return Math.floor(prevAmount * multiplier);
      }
      return base;
    }

    return base;
  };

  const runGuardianCheck = (balance: number, proposedAmount: number): boolean => {
    if (balance > 0 && balance < proposedAmount) {
      addLog('SISTEMA', `Saldo insuficiente ($${balance} < requerido $${proposedAmount})`, 'warning');
      return false;
    }
    
    // Aquí puedes agregar más validaciones del guardián (Stop Loss diario, rachas de pérdida, etc)
    const recentLosses = recentTrades.filter((t: any) => t.status === 'loss').length;
    const maxLosses = botParams?.maxLosses ?? 3; // Permitir rachas configurables
    // Limitamos la revisión a las últimas 3 operaciones
    const currentLosingStreak = recentTrades.slice(0, maxLosses).every((t: any) => t.status === 'loss');
    
    if (currentLosingStreak && recentTrades.length >= maxLosses) {
      addLog('SISTEMA', `Pausa de seguridad: ${maxLosses} pérdidas consecutivas.`, 'error');
      setIsRunning(false); // Apagar el bot por seguridad
      return false;
    }

    return true;
  };

  const engineLoop = async () => {
    if (!isRunning || !bridgeOnline || !brokerConfig?.email || !brokerConfig?.password || isExecutingRef.current) {
      loopTimeoutRef.current = setTimeout(engineLoop, 3000);
      return;
    }

    const pairs: string[] = (botParams?.pairs && Array.isArray(botParams.pairs) && botParams.pairs.length > 0)
      ? botParams.pairs
      : ['EURUSD-OTC'];
    
    const minConfidence = botParams?.min_confidence_score ?? 85;

    for (const pair of pairs) {
      if (!isRunning) break; // Si el usuario lo apagó durante el ciclo

      try {
        const result = await bridgeAnalyze({
          email: brokerConfig.email,
          password: brokerConfig.password,
          pair,
          accountType: currentAccountType,
          minRsi: 30,
          maxRsi: 70
        });

        if (!result.success) {
          addLog('BRIDGE', `Fallo analizando ${pair}: ${result.error}`, 'error');
          continue;
        }

        const { direction, probability, rsi, candles, balance } = result;

        // Actualizar el estado para la UI (Terminal HFT)
        setAnalyses(prev => ({
          ...prev,
          [pair]: { direction, probability, rsi, candles, lastUpdated: new Date() }
        }));

        addLog('SISTEMA', `Análisis ${pair} - RSI: ${rsi}`, 'info');

        if (direction !== 'NONE' && probability >= minConfidence) {
          addLog('QUANTUM-X', `Señal ${direction} en ${pair} - precisión ${probability.toFixed(0)}%`, 'success');
          
          if (isExecutingRef.current) {
            addLog('SISTEMA', `Ignorando señal en ${pair} porque hay otra operación en curso.`, 'warning');
            continue;
          }

          const amount = calculateAmount(balance || 0);

          if (!runGuardianCheck(balance || 0, amount)) continue;

          // DISPARAR OPERACIÓN
          isExecutingRef.current = true;
          addLog('V7-MAESTRO', `EJECUTANDO ORDEN ${direction} POR $${amount} EN ${pair}...`, 'warning');
          playInvestSound();

          const tradeResult = await bridgeTrade({
            email: brokerConfig.email,
            password: brokerConfig.password,
            pair,
            direction,
            amount,
            accountType: currentAccountType
          });

          if (tradeResult.success && user && firestore) {
            const timestamp = new Date().toISOString();
            const profit = tradeResult.profit;
            const status = tradeResult.status;

            await addDoc(collection(firestore, 'users', user.uid, 'trades'), {
              pair, direction, amount, status, profit,
              orderId: tradeResult.orderId,
              timestamp, accountType: currentAccountType,
              broker: 'IQ Option',
            });

            // Actualizar Stats
            const statsRefLocal = doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType);
            const statsSnap = await getDoc(statsRefLocal);
            const currentStats = statsSnap.data() || { 
              balance: tradeResult.balance, totalTrades: 0, winRate: 0, wins: 0, losses: 0, dailyProfit: 0 
            };

            const isWin = status === 'win';
            const isLoss = status === 'loss';
            const newWins = (currentStats.wins || 0) + (isWin ? 1 : 0);
            const newLosses = (currentStats.losses || 0) + (isLoss ? 1 : 0);
            const newTotal = (currentStats.totalTrades || 0) + 1;
            const newWinRate = Math.round((newWins / newTotal) * 100);
            const newDailyProfit = (currentStats.dailyProfit || 0) + profit;

            await setDoc(statsRefLocal, {
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

            addLog('SISTEMA', `Operación finalizada: ${status.toUpperCase()} | Beneficio: $${profit}`, isWin ? 'success' : 'error');
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
      
      // Breve pausa entre pares para no saturar IQ Option
      await new Promise(r => setTimeout(r, 1500));
    }

    // Volver a llamar el loop
    loopTimeoutRef.current = setTimeout(engineLoop, 2000);
  };

  useEffect(() => {
    if (mounted && user) {
      engineLoop();
    }
    return () => {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, isRunning, bridgeOnline, brokerConfig]);

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
