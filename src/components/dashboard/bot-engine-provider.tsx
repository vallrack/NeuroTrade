'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { useRTDB } from '@/firebase/provider';
import { doc, collection, addDoc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
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
  // ─ Datos sincronizados en tiempo real desde el puente ─
  liveBalance: number | null;
  liveProfit: number;
  liveWins: number;
  liveLosses: number;
  sessionStartBalance: number | null;
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

// ─── Guardado resiliente en Firestore (reintenta 3 veces) ────────────────────
async function saveWithRetry(fn: () => Promise<void>, attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return true;
    } catch (e) {
      if (i === attempts - 1) console.error('[SAVE_RETRY] Falló tras 3 intentos:', e);
      else await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return false;
}

export function BotEngineProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [isRunning, setIsRunning] = useState(true);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);

  // ─── Estado en tiempo real (fuente de verdad: el puente, NO Firestore) ──────
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [liveProfit, setLiveProfit] = useState(0);
  const [liveWins, setLiveWins] = useState(0);
  const [liveLosses, setLiveLosses] = useState(0);
  const [sessionStartBalance, setSessionStartBalance] = useState<number | null>(null);

  // Refs
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const isRunningRef = useRef(true);
  const bridgeOnlineRef = useRef<boolean | null>(null);
  const brokerConfigRef = useRef<any>(null);
  const botParamsRef2 = useRef<any>(null);
  const recentTradesRef = useRef<any[]>([]);
  const userRef = useRef(user);
  const firestoreRef = useRef(firestore);
  const rtdbRef2 = useRef(rtdb);
  const lastScheduleLogRef = useRef<number>(0);
  const sessionStartBalanceRef = useRef<number | null>(null);
  const sessionProfitRef = useRef<number>(0);
  const sessionWinsRef = useRef<number>(0);
  const sessionLossesRef = useRef<number>(0);

  // Sincronizar refs
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { bridgeOnlineRef.current = bridgeOnline; }, [bridgeOnline]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { firestoreRef.current = firestore; }, [firestore]);
  useEffect(() => { rtdbRef2.current = rtdb; }, [rtdb]);

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

  // ─── Función de sincronización de balance ─────────────────────────────────────
  const syncBalance = useCallback(async (balance: number, accountType: string) => {
    const currentUser = userRef.current;
    const currentFirestore = firestoreRef.current;
    const currentRTDB = rtdbRef2.current;

    // 1. Estado React (inmediato, visible en UI)
    setLiveBalance(balance);

    // Inicializar balance de sesión al primer dato
    if (sessionStartBalanceRef.current === null && balance > 0) {
      sessionStartBalanceRef.current = balance;
      setSessionStartBalance(balance);
    }

    // 2. Emitir evento global para StatsGrid y otros componentes
    window.dispatchEvent(new CustomEvent('nt_bridge_data', {
      detail: { success: true, balance, accountType }
    }));

    // 3. Guardar en RTDB (tiempo real, más rápido que Firestore)
    if (currentRTDB && currentUser && balance > 0) {
      try {
        await rtdbSet(
          rtdbRef(currentRTDB, `users/${currentUser.uid}/trading_stats/${accountType}/balance`),
          balance
        );
      } catch { /* RTDB opcional */ }
    }

    // 4. Guardar en Firestore (para persistencia)
    if (currentFirestore && currentUser && balance > 0) {
      const statsRef = doc(currentFirestore, 'users', currentUser.uid, 'trading_stats', accountType);
      await saveWithRetry(async () => {
        await setDoc(statsRef, { balance, lastSync: new Date().toISOString() }, { merge: true });
      });
    }
  }, []);

  // Health check del puente
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
      // Martingale SOLO si el último trade está guardado en Firestore
      const trades = recentTradesRef.current;
      if (trades.length === 0) return base; // Sin historial guardado → siempre base
      const lastTrade = trades[0];
      // Solo doblar si el último trade fue hace menos de 10 minutos (reciente y guardado)
      const lastTradeTime = new Date(lastTrade.timestamp).getTime();
      const tenMinsAgo = Date.now() - 10 * 60 * 1000;
      if (lastTrade.status === 'loss' && lastTradeTime > tenMinsAgo) {
        const multiplier = params.martingaleMultiplier || 2.1;
        return Math.floor((lastTrade.amount || base) * multiplier);
      }
      return base;
    }
    return base;
  }, []);

  const runGuardianCheck = useCallback((balance: number, proposedAmount: number, params: any): boolean => {
    // Verificar saldo suficiente
    if (balance > 0 && balance < proposedAmount) {
      addLog('SISTEMA', `Saldo insuficiente ($${balance.toFixed(2)} < requerido $${proposedAmount})`, 'warning');
      return false;
    }

    // Verificar stop-loss de sesión
    if (sessionStartBalanceRef.current !== null && sessionStartBalanceRef.current > 0) {
      const lossPercent = ((sessionStartBalanceRef.current - balance) / sessionStartBalanceRef.current) * 100;
      const maxDrawdown = params?.max_drawdown ?? 20;
      if (lossPercent >= maxDrawdown) {
        addLog('SISTEMA', `⛔ STOP-LOSS ACTIVADO — pérdida del ${lossPercent.toFixed(1)}% (límite: ${maxDrawdown}%)`, 'error');
        setIsRunning(false);
        return false;
      }
    }

    // Verificar racha de pérdidas
    const maxLosses = params?.maxLosses ?? 3;
    const trades = recentTradesRef.current;
    if (trades.length >= maxLosses) {
      const streak = trades.slice(0, maxLosses).every((t: any) => t.status === 'loss');
      if (streak) {
        addLog('SISTEMA', `Pausa de seguridad: ${maxLosses} pérdidas consecutivas.`, 'error');
        setIsRunning(false);
        return false;
      }
    }

    return true;
  }, [addLog]);

  // ─── ENGINE LOOP ──────────────────────────────────────────────────────────────
  const engineLoop = useCallback(async () => {
    const config = brokerConfigRef.current;
    const params = botParamsRef2.current;
    const isBridgeOnline = bridgeOnlineRef.current;
    const currentUser = userRef.current;
    const currentFirestore = firestoreRef.current;
    const accountType = config?.accountType || 'demo';

    // ── 1. AutoPilot: selección de pares y horario ──
    const autopilot = params?.autopilot ?? DEFAULT_AUTOPILOT;
    const regularPairs: string[] = params?.regularPairs ?? ['EURUSD', 'GBPUSD', 'USDJPY'];
    const otcPairs: string[] = params?.otcPairs ?? ['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC'];
    const manualPairs: string[] = (params?.pairs && Array.isArray(params.pairs)) ? params.pairs : ['EURUSD-OTC'];

    const { pairs: activePairs, reason } = getActivePairs(autopilot, regularPairs, otcPairs, manualPairs);
    const status = getMarketStatus(autopilot, regularPairs, otcPairs, manualPairs);
    setMarketStatus(status);

    // ── 2. Fuera de horario ──
    if (autopilot.enabled && autopilot.scheduleMode === 'custom' && activePairs.length === 0) {
      const now = Date.now();
      if (now - lastScheduleLogRef.current > 5 * 60 * 1000) {
        addLog('AUTOPILOT', `Fuera de horario. ${status.sublabel}`, 'warning');
        lastScheduleLogRef.current = now;
      }
      loopTimeoutRef.current = setTimeout(engineLoop, 60000);
      return;
    }

    // ── 3. Verificar condiciones base ──
    if (!isBridgeOnline || !config?.email || !config?.password || isExecutingRef.current) {
      loopTimeoutRef.current = setTimeout(engineLoop, 3000);
      return;
    }

    // Bot pausado manualmente
    if (!isRunningRef.current) {
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

        // Sincronizar balance del analyze response
        if (result.success && result.balance != null && result.balance > 0) {
          await syncBalance(result.balance, accountType);
        }

        if (!result.success) {
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

          const currentBalance = liveBalance ?? (balance || 0);
          const amount = calculateAmount(currentBalance);

          if (!runGuardianCheck(currentBalance, amount, params)) continue;

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

          // ─── Sincronizar balance INMEDIATAMENTE tras el trade ──────────────────
          if (tradeResult.balance != null && tradeResult.balance > 0) {
            await syncBalance(tradeResult.balance, accountType);
          }

          if (tradeResult.success) {
            const timestamp = new Date().toISOString();
            const { profit, status: tradeStatus } = tradeResult;
            const isWin = tradeStatus === 'win';
            const isLoss = tradeStatus === 'loss';

            // Actualizar contadores de sesión
            sessionProfitRef.current += profit ?? 0;
            if (isWin) sessionWinsRef.current += 1;
            if (isLoss) sessionLossesRef.current += 1;
            setLiveProfit(sessionProfitRef.current);
            setLiveWins(sessionWinsRef.current);
            setLiveLosses(sessionLossesRef.current);

            if (isWin) playWinSound();
            else if (isLoss) playLossSound();

            addLog('SISTEMA', `Resultado: ${tradeStatus!.toUpperCase()} | ${profit >= 0 ? '+' : ''}$${profit}`, isWin ? 'success' : 'error');

            // ─── Guardar en Firestore CON REINTENTO ──────────────────────────────
            if (currentUser && currentFirestore) {
              // Guardar trade
              const tradeSaved = await saveWithRetry(async () => {
                await addDoc(collection(currentFirestore, 'users', currentUser.uid, 'trades'), {
                  pair, direction, amount,
                  status: tradeStatus, profit,
                  orderId: tradeResult.orderId,
                  timestamp, accountType,
                  broker: 'IQ Option',
                });
              });

              if (!tradeSaved) {
                addLog('SISTEMA', `⚠️ Trade ejecutado pero no guardado en Firestore. Balance real: $${tradeResult.balance}`, 'warning');
              }

              // Actualizar estadísticas
              const statsRef = doc(currentFirestore, 'users', currentUser.uid, 'trading_stats', accountType);
              await saveWithRetry(async () => {
                const statsSnap = await getDoc(statsRef);
                const currentStats = statsSnap.data() || { totalTrades: 0, wins: 0, losses: 0, dailyProfit: 0 };
                const newWins = (currentStats.wins || 0) + (isWin ? 1 : 0);
                const newLosses = (currentStats.losses || 0) + (isLoss ? 1 : 0);
                const newTotal = (currentStats.totalTrades || 0) + 1;
                await setDoc(statsRef, {
                  balance: tradeResult.balance,
                  totalTrades: newTotal,
                  tradesCount: newTotal,
                  winsCount: newWins,
                  wins: newWins,
                  losses: newLosses,
                  winRate: Math.round((newWins / newTotal) * 100),
                  dailyProfit: (currentStats.dailyProfit || 0) + (profit ?? 0),
                  totalInvestment: (currentStats.totalInvestment || 0) + amount,
                  lastUpdate: timestamp,
                }, { merge: true });
              });
            }
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
  }, [addLog, calculateAmount, runGuardianCheck, syncBalance, liveBalance]);

  // Arrancar el loop UNA SOLA VEZ
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
      logs, analyses, isRunning, bridgeOnline, toggleEngine, clearLogs,
      activePairs: uiPairs.length > 0 ? uiPairs : (params?.pairs ?? ['EURUSD-OTC']),
      marketStatus,
      liveBalance, liveProfit, liveWins, liveLosses, sessionStartBalance,
    }}>
      {children}
    </BotEngineContext.Provider>
  );
}
