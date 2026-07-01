'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { useRTDB } from '@/firebase/provider';
import { doc, collection, addDoc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { bridgeAnalyze, bridgeTrade, bridgeTradeResult, getBridgeUrl, fetchWithTimeout } from '@/lib/bridge';
import { playInvestSound, playWinSound, playLossSound } from '@/lib/sounds';
import { getActivePairs, getMarketStatus, type MarketStatus } from '@/lib/market-schedule';
import { getPresetForDay } from '@/lib/plan-15-days';

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
  isManipulated?: boolean;
  manipulationReason?: string;
  candles?: any[];
  lastUpdated: Date;
};

interface BotEngineContextValue {
  logs: LogEntry[];
  analyses: Record<string, AnalysisState>;
  isRunning: boolean;
  isPreAnalyzing: boolean;
  bridgeOnline: boolean | null;
  toggleEngine: () => void;
  forceStartEngine: () => void;
  activePairs: string[];
  clearLogs: () => void;
  marketStatus: MarketStatus | null;
  // ─ Datos sincronizados en tiempo real desde el puente ─
  liveBalance: number | null;
  liveProfit: number;
  liveWins: number;
  liveLosses: number;
  sessionStartBalance: number | null;
  // ─ Historial de operaciones (para campana) ─
  recentTrades: any[];
  // ─ Pares Dinámicos desde el Broker ─
  availablePairs: string[];
  availableOtcPairs: string[];
  availableRegularPairs: string[];
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
  const [isRunning, setIsRunning] = useState(false);
  const [isPreAnalyzing, setIsPreAnalyzing] = useState(false);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);

  // ─── Estado en tiempo real (fuente de verdad: el puente, NO Firestore) ──────
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [liveProfit, setLiveProfit] = useState(0);
  const [liveWins, setLiveWins] = useState(0);
  const [liveLosses, setLiveLosses] = useState(0);
  const [sessionStartBalance, setSessionStartBalance] = useState<number | null>(null);

  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [availableOtcPairs, setAvailableOtcPairs] = useState<string[]>([]);
  const [availableRegularPairs, setAvailableRegularPairs] = useState<string[]>([]);

  // Refs
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);
  const isRunningRef = useRef(false);
  const isPreAnalyzingRef = useRef(false);
  const preAnalysisStartTimeRef = useRef<number>(0);
  const preAnalysisProbabilitiesRef = useRef<number[]>([]);
  const bridgeOnlineRef = useRef<boolean | null>(null);
  const brokerConfigRef = useRef<any>(null);
  const botParamsRef2 = useRef<any>(null);
  const recentTradesRef = useRef<any[]>([]);
  const userRef = useRef(user);
  const firestoreRef = useRef(firestore);
  const rtdbRef2 = useRef(rtdb);
  const calendarEventsRef = useRef<any[]>([]);
  const lastScheduleLogRef = useRef<number>(0);
  const sessionStartBalanceRef = useRef<number | null>(null);
  const sessionProfitRef = useRef<number>(0);
  const sessionWinsRef = useRef<number>(0);
  const sessionLossesRef = useRef<number>(0);
  const liveBalanceRef = useRef<number | null>(null);
  const winsSinceLastPromptRef = useRef<number>(0);
  // FIX #5: Recolectar RSI durante el pre-análisis para recomendaciones más reales
  const preAnalysisRsiRef = useRef<number[]>([]);

  // Sincronizar refs
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isPreAnalyzingRef.current = isPreAnalyzing; }, [isPreAnalyzing]);
  useEffect(() => { bridgeOnlineRef.current = bridgeOnline; }, [bridgeOnline]);
  useEffect(() => { liveBalanceRef.current = liveBalance; }, [liveBalance]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { firestoreRef.current = firestore; }, [firestore]);
  useEffect(() => { rtdbRef2.current = rtdb; }, [rtdb]);

  // Firestore listeners
  const brokerDocRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const botParamsDocRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'bot_params') : null;

  const { data: brokerConfig } = useDoc(brokerDocRef);
  const { data: botParams } = useDoc(botParamsDocRef);

  const currentAccountType = brokerConfig?.accountType || 'demo';

  const tradesQuery = user && firestore
    ? query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(100))
    : null;
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = recentTradesRaw?.filter((t: any) => t.accountType === currentAccountType) || [];

  useEffect(() => { brokerConfigRef.current = brokerConfig; }, [brokerConfig]);
  useEffect(() => { botParamsRef2.current = botParams; }, [botParams]);
  useEffect(() => { recentTradesRef.current = recentTrades; }, [recentTrades]);
  const hourlyStatsRef = useRef<Record<string, { wins: number, losses: number, profit: number }>>({});
  const pairStatsRef = useRef<Record<string, { wins: number, losses: number, profit: number }>>({});

  // ─── RESET COMPLETO cuando cambia la cuenta conectada ────────────────────────
  const prevAccountKeyRef = useRef<string>('');
  useEffect(() => {
    if (!brokerConfig) return;
    const accountKey = `${brokerConfig.email}|${brokerConfig.accountType}|${brokerConfig.status}`;
    if (accountKey === prevAccountKeyRef.current) return;
    prevAccountKeyRef.current = accountKey;

    // Resetear stats de sesion para no contaminar la nueva cuenta
    setLiveBalance(null);
    setLiveProfit(0);
    setLiveWins(0);
    setLiveLosses(0);
    setSessionStartBalance(null);
    sessionStartBalanceRef.current = null;
    sessionProfitRef.current = 0;
    sessionWinsRef.current = 0;
    sessionLossesRef.current = 0;
    hourlyStatsRef.current = {};
    pairStatsRef.current = {};
    winsSinceLastPromptRef.current = 0;
    preAnalysisRsiRef.current = []; // FIX #5: limpiar RSI al cambiar de cuenta
    setAnalyses({});
    setAvailablePairs([]);
    setAvailableOtcPairs([]);
    setAvailableRegularPairs([]);
    setIsPreAnalyzing(false);
    preAnalysisStartTimeRef.current = 0;
    preAnalysisProbabilitiesRef.current = [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerConfig?.email, brokerConfig?.accountType, brokerConfig?.status]);

  const addLog = useCallback((source: string, message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const newLogs = [{ id: Math.random().toString(36).substring(7), timestamp: new Date(), source, message, type }, ...prev];
      return newLogs.slice(0, 200);
    });
  }, []);

  const clearLogs = () => setLogs([]);
  const hasDonePreAnalysisRef = useRef<boolean>(false);

  const toggleEngine = () => {
    if (!isRunning) {
      if (!hasDonePreAnalysisRef.current) {
        setIsPreAnalyzing(true);
        preAnalysisStartTimeRef.current = Date.now();
        addLog('SISTEMA', 'Iniciando escuadrón de reconocimiento (90s pre-análisis)...', 'info');
      } else {
        setIsRunning(true);
        addLog('SISTEMA', 'Motor de trading encendido (Bypass Pre-análisis).', 'success');
      }
    } else {
      setIsRunning(false);
      addLog('SISTEMA', 'Motor de trading apagado.', 'warning');
    }
  };

  const forceStartEngine = () => {
    setIsPreAnalyzing(false);
    preAnalysisStartTimeRef.current = 0;
    preAnalysisProbabilitiesRef.current = [];
    preAnalysisRsiRef.current = [];
    hasDonePreAnalysisRef.current = true;
    winsSinceLastPromptRef.current = 0;
    setIsRunning(true);
    addLog('SISTEMA', 'Motor de trading arrancado (Fin del Pre-Análisis).', 'success');
  };

  // ─── Kill Switch: escuchar bot_activo en Firestore ────────────────────────
  useEffect(() => {
    if (botParams?.bot_activo === false && isRunningRef.current) {
      setIsRunning(false);
      setIsPreAnalyzing(false);
      addLog('SISTEMA', '🛑 ABORTO DE EMERGENCIA recibido — Motor detenido.', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botParams?.bot_activo]);


  useEffect(() => { setMounted(true); }, []);

  // Fetch pares dinámicos
  useEffect(() => {
    import('@/lib/bridge').then(({ bridgeGetActives }) => {
      if (brokerConfig?.status === 'connected' && brokerConfig.email && brokerConfig.password) {
        bridgeGetActives({
          email: brokerConfig.email,
          password: brokerConfig.password,
          accountType: brokerConfig.accountType || 'demo',
          brokerType: brokerConfig.brokerType || 'iqoption'
        }).then(res => {
          if (res.success && res.pairs) {
            setAvailablePairs(res.pairs);
            setAvailableOtcPairs(res.otc || []);
            setAvailableRegularPairs(res.regular || []);
          }
        }).catch(err => {
          console.error("Error fetching actives:", err);
        });
      }
    });
  }, [brokerConfig?.status, brokerConfig?.email, brokerConfig?.password, brokerConfig?.accountType]);

  // ─── Función de sincronización de balance ─────────────────────────────────────
  const syncBalance = useCallback(async (balance: number, accountType: string) => {
    const currentUser = userRef.current;
    const currentFirestore = firestoreRef.current;
    const currentRTDB = rtdbRef2.current;
    const currentBroker = brokerConfigRef.current;

    // GUARDIA: solo aplicar balance si coincide con la cuenta actualmente conectada
    // Esto evita mostrar el balance de la cuenta anterior al cambiar de cuenta
    if (currentBroker?.accountType && currentBroker.accountType !== accountType) {
      return; // Balance de otra cuenta — ignorar
    }
    if (currentBroker?.status === 'disconnected') {
      return; // Cuenta desconectada — no actualizar
    }

    // 1. Estado React (inmediato, visible en UI)
    setLiveBalance(balance);

    // Inicializar balance de sesión al primer dato válido
    if (sessionStartBalanceRef.current === null && balance >= 0) {
      sessionStartBalanceRef.current = balance;
      setSessionStartBalance(balance);
    }

    // 2. Emitir evento global para StatsGrid y otros componentes
    window.dispatchEvent(new CustomEvent('nt_bridge_data', {
      detail: { success: true, balance, accountType }
    }));

    // 3. Guardar en RTDB (tiempo real, más rápido que Firestore)
    if (currentRTDB && currentUser && balance >= 0) {
      try {
        await rtdbSet(
          rtdbRef(currentRTDB, `users/${currentUser.uid}/trading_stats/${accountType}/balance`),
          balance
        );
      } catch { /* RTDB opcional */ }
    }

    // 4. Guardar en Firestore (para persistencia)
    if (currentFirestore && currentUser && balance >= 0) {
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
        }, 15000);
        setBridgeOnline(res.ok);
      } catch {
        setBridgeOnline(false);
      }
    };
    checkBridge();
    interval = setInterval(checkBridge, 10000);

    // Re-chequeo inmediato bajo demanda (guardado de Riesgo, botón "Bypass DB")
    const onForceSync = () => { checkBridge(); };
    window.addEventListener('nt_force_sync', onForceSync);

    // Fetch calendar events
    const fetchCalendar = async () => {
      try {
        const res = await fetch('/api/calendar');
        const data = await res.json();
        if (data.success) {
          calendarEventsRef.current = data.events || [];
        }
      } catch (err) {
        console.error("Error fetching calendar for bot engine:", err);
      }
    };
    fetchCalendar();
    const calendarInterval = setInterval(fetchCalendar, 15 * 60 * 1000); // 15 mins

    // FIX #10: Keep-alive — ping al worker cada 10 min mientras el motor est\u00e1 activo
    // Evita que el worker se apague por inactividad si el mercado no da se\u00f1ales
    const keepAliveInterval = setInterval(async () => {
      if (!isRunningRef.current) return;
      try {
        const { getBridgeUrl, getBridgeHeaders } = await import('@/lib/bridge');
        await fetch(`${getBridgeUrl()}/health`, {
          method: 'GET',
          headers: getBridgeHeaders(),
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* silencioso */ }
    }, 10 * 60 * 1000); // cada 10 minutos

    return () => {
      clearInterval(interval);
      clearInterval(calendarInterval);
      clearInterval(keepAliveInterval);
      window.removeEventListener('nt_force_sync', onForceSync);
    };
  }, []);

  const calculateAmount = useCallback((balance: number): number => {
    const params = botParamsRef2.current;
    const config = brokerConfigRef.current;
    const accountType = config?.accountType || 'demo';
    
    // Si la cuenta es REAL y el balance es grande, asumimos que es COP y el min es 2000.
    // Si la cuenta es demo, el min es 1 (demo USD).
    const minAmount = (accountType === 'real' || balance > 10000) ? 2000 : 1;

    if (!params) return minAmount;
    const mode = params.moneyManagementMode || 'fixed';
    const base = params.investmentPerTrade || 500;
    
    if (mode === 'fixed') return Math.max(base, minAmount);
    if (mode === 'compound') {
      const percent = params.compoundPercentage || 5;
      const amt = Math.floor(balance * (percent / 100));
      return amt < minAmount ? minAmount : amt;
    }
    if (mode === 'martingale') {
      // Martingale SOLO si el último trade está guardado en Firestore
      const trades = recentTradesRef.current;
      if (trades.length === 0) return Math.max(base, minAmount); // Sin historial guardado → siempre base
      const lastTrade = trades[0];
      // Solo doblar si el último trade fue hace menos de 10 minutos (reciente y guardado)
      const lastTradeTime = new Date(lastTrade.timestamp).getTime();
      const tenMinsAgo = Date.now() - 10 * 60 * 1000;
      if (lastTrade.status === 'loss' && lastTradeTime > tenMinsAgo) {
        const multiplier = params.martingaleMultiplier || 2.1;
        const previousAmount = lastTrade.amount || base;
        const newAmount = Math.floor(previousAmount * multiplier);
        return Math.max(newAmount, minAmount);
      }
      return Math.max(base, minAmount);
    }
    return Math.max(base, minAmount);
  }, []);

  const runGuardianCheck = useCallback((balance: number, proposedAmount: number, params: any): boolean => {
    // Verificar saldo suficiente
    if (balance >= 0 && balance < proposedAmount) {
      addLog('SISTEMA', `Saldo insuficiente ($${balance.toFixed(2)} < requerido $${proposedAmount})`, 'warning');
      return false;
    }

    // Verificar meta diaria (Plan 15 Días)
    if (sessionStartBalanceRef.current !== null && sessionStartBalanceRef.current > 0 && params?.dailyGoalPercent) {
      const profitPercent = ((balance - sessionStartBalanceRef.current) / sessionStartBalanceRef.current) * 100;
      if (profitPercent >= params.dailyGoalPercent) {
        addLog('SISTEMA', `✅ META DIARIA ALCANZADA — ganancia del ${profitPercent.toFixed(1)}% (meta: ${params.dailyGoalPercent}%)`, 'success');
        
        // Disparar evento para que se genere el reporte y se avance de día
        window.dispatchEvent(new CustomEvent('nt_daily_goal_reached', {
          detail: { 
            balance, 
            profit: balance - sessionStartBalanceRef.current,
            profitPercent,
            planPhase: params.planPhase,
            planDay: params.planDay,
            hourlyStats: hourlyStatsRef.current,
            pairStats: pairStatsRef.current
          }
        }));
        
        setIsRunning(false); // Detener el bot automáticamente
        return false;
      }
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

    // Verificar racha de pérdidas de la sesión actual
    const maxLosses = params?.maxLosses ?? 3;
    if (sessionLossesRef.current >= maxLosses) {
      addLog('SISTEMA', `Pausa de seguridad: ${sessionLossesRef.current} pérdidas en esta sesión.`, 'error');
      setIsRunning(false);
      return false;
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

    // ── 0. Verificar timeout de pre-análisis SIEMPRE (incluso si hay early returns) ──
    if (isPreAnalyzingRef.current) {
      const now = Date.now();
      if (now - preAnalysisStartTimeRef.current >= 90000) { // 90 segundos
        isPreAnalyzingRef.current = false;
        setIsPreAnalyzing(false);

        const probs = preAnalysisProbabilitiesRef.current;
        const rsiArr = preAnalysisRsiRef.current;

        // FIX #5: usar RSI real para calcular condición del mercado
        const avg = probs.length > 0 ? probs.reduce((a, b) => a + b, 0) / probs.length : 0;
        const avgRsi = rsiArr.length > 0 ? rsiArr.reduce((a, b) => a + b, 0) / rsiArr.length : 50;
        const signalCount = probs.length;

        // ── FASE-AWARE FIX: leer la configuración activa del usuario ──────────
        const currentBotParams = botParamsRef2.current;
        const currentBrokerCfg = brokerConfigRef.current;
        const activePlanPhase: number | null = currentBotParams?.planPhase ?? null;
        const activePlanDay: number | null = currentBotParams?.planDay ?? null;
        const activeAccountType: string = currentBrokerCfg?.accountType || 'demo';
        const hasActivePlan = activePlanPhase !== null && activePlanDay !== null;

        // Determinar condición real del mercado por RSI + señales detectadas
        let riskLevel = 'Alto (mercado sin señales claras)';

        // Sugerencias de meta diaria según condición del mercado
        // (el porcentaje de inversión solo se sugiere si NO hay plan activo)
        let newGoalPercent = 10;
        let newCompoundPercent = 2; // Sólo relevante si !hasActivePlan

        if (signalCount >= 3 && avg >= 75) {
          riskLevel = 'Bajo (señales fuertes detectadas)';
          newGoalPercent = 30;
          newCompoundPercent = 10;
        } else if (signalCount >= 1 && avg >= 60) {
          riskLevel = 'Medio (señales moderadas)';
          newGoalPercent = 20;
          newCompoundPercent = 5;
        } else if (avgRsi < 40 || avgRsi > 60) {
          riskLevel = 'Medio (RSI en zona extrema, posible rebote)';
          newGoalPercent = 15;
          newCompoundPercent = 4;
        }

        // Si hay plan activo, respetar la meta del plan para no ser muy agresivos
        // (la meta sugerida nunca supera la meta configurada en el plan + 5 puntos)
        if (hasActivePlan && currentBotParams?.dailyGoalPercent) {
          const planGoal = currentBotParams.dailyGoalPercent as number;
          // Sugerir la meta del mercado, pero no más de plan+5 para ser conservadores
          newGoalPercent = Math.min(newGoalPercent, planGoal + 5);
        }

        window.dispatchEvent(new CustomEvent('nt_ai_army_prompt', {
          detail: {
            avgProb: avg > 0 ? avg : (avgRsi < 40 || avgRsi > 60 ? 62 : 50),
            avgRsi: Math.round(avgRsi * 10) / 10,
            signalCount,
            riskLevel,
            newCompoundPercent,
            newGoalPercent,
            // ── Datos de la fase activa para que el modal los muestre ──
            hasActivePlan,
            activePlanPhase,
            activePlanDay,
            activeAccountType,
            currentDailyGoal: currentBotParams?.dailyGoalPercent ?? null,
            currentMoneyMode: currentBotParams?.moneyManagementMode ?? null,
          }
        }));
      }
    }

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
    if (!isBridgeOnline || !config?.email || !config?.password || !config?.status || config.status !== 'connected' || isExecutingRef.current) {
      if (config && config.status !== 'connected' && config.status !== undefined) {
        // Registrar UNA sola vez que el broker no está vinculado (no spammear)
        const now = Date.now();
        if (now - lastScheduleLogRef.current > 2 * 60 * 1000) {
          addLog('SISTEMA', 'Broker no conectado. Vincula tu cuenta en Broker Link para operar.', 'warning');
          lastScheduleLogRef.current = now;
        }
      }
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

    // ── 3.5. Chequeo de Calendario Económico (High Impact) ──
    const nowMs = Date.now();
    const upcomingHighImpact = calendarEventsRef.current.filter(ev => {
      if (ev.impact !== 'High' || !ev.dateObj) return false;
      const evTime = new Date(ev.dateObj).getTime();
      // ± 15 mins
      return Math.abs(evTime - nowMs) <= 15 * 60 * 1000;
    });

    // ── 4. Analizar cada par ──
    for (const pair of pairs) {
      try {
        // Verificar si el par contiene alguna moneda con noticia de alto impacto
        const isImpacted = upcomingHighImpact.some(ev => pair.includes(ev.country));
        if (isImpacted) {
          const ev = upcomingHighImpact.find(ev => pair.includes(ev.country));
          const msg = `Noticia HIGH IMPACT (${ev.country}: ${ev.title}). Pausando operativa en ${pair}.`;
          if (nowMs - lastScheduleLogRef.current > 60 * 1000) {
            addLog('SENTINEL', msg, 'error');
            lastScheduleLogRef.current = nowMs;
          }
          continue; // Ignorar análisis y trading para este par
        }
        // Determinar límites de RSI según el modo de estrategia
        let currentMinRsi = 30;
        let currentMaxRsi = 70;
        if (params?.strategy_mode === 'aggressive') {
          currentMinRsi = 40;
          currentMaxRsi = 60;
        } else if (params?.strategy_mode === 'conservative') {
          currentMinRsi = 25;
          currentMaxRsi = 75;
        }

        addLog('BRIDGE', `Analizando ${pair} → ${getBridgeUrl()}/analyze`, 'info');

        // Calcular monedas bloqueadas por noticias y pasarlas al Python
        // (doble protección: el JS ya filtra arriba, pero el worker también lo verifica)
        const blockedCurrencies = [...new Set(
          upcomingHighImpact.flatMap(ev => {
            const country = (ev.country || '').toUpperCase();
            // Mapa país → código de moneda
            const countryToCurrency: Record<string, string> = {
              'USD': 'USD', 'EUR': 'EUR', 'GBP': 'GBP', 'JPY': 'JPY',
              'CAD': 'CAD', 'AUD': 'AUD', 'NZD': 'NZD', 'CHF': 'CHF',
              'US': 'USD', 'EU': 'EUR', 'UK': 'GBP', 'JP': 'JPY',
            };
            return countryToCurrency[country] ? [countryToCurrency[country]] : [country];
          })
        )];

        const result = await bridgeAnalyze({
          email: config.email,
          password: config.password,
          pair,
          accountType,
          brokerType: config.brokerType || 'iqoption',
          minRsi: currentMinRsi,
          maxRsi: currentMaxRsi,
          manipulationVolMultiplier: params?.manipulationVolMultiplier,
          manipulationMaxBody: params?.manipulationMaxBody,
          blockedPairs: blockedCurrencies,
        });

        // Sincronizar balance del analyze response
        if (result.success && result.balance != null && result.balance >= 0) {
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

        const { direction = 'NONE', probability = 0, rsi = 50, isManipulated = false, manipulationReason = '', candles = [], balance } = result;

        setAnalyses((prev: Record<string, AnalysisState>) => ({
          ...prev,
          [pair]: { 
            direction: direction as "CALL" | "PUT" | "NONE", 
            probability, 
            rsi, 
            isManipulated, 
            manipulationReason, 
            candles, 
            lastUpdated: new Date() 
          }
        }));

        addLog('SISTEMA', `${pair} — RSI: ${rsi} | ${direction} (${probability.toFixed(0)}%)`, 'info');

        // ── Lógica de acumulación en Pre-Análisis ──
        if (isPreAnalyzingRef.current) {
          if (probability > 0) {
            preAnalysisProbabilitiesRef.current.push(probability);
          }
          // FIX #5: acumular RSI siempre (aunque no haya señal) para evaluar condición de mercado
          if (result.rsi !== undefined && result.rsi !== 50) {
            preAnalysisRsiRef.current.push(result.rsi);
          }
          // En pre-análisis NUNCA operamos, pasamos al siguiente par
          continue; 
        }

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

          const currentBalance = liveBalanceRef.current ?? (balance || 0);
          const amount = calculateAmount(currentBalance);

          if (!runGuardianCheck(currentBalance, amount, params)) continue;

          isExecutingRef.current = true;

          let finalDirection: "CALL" | "PUT" = (direction === 'CALL' || direction === 'PUT') ? direction : 'CALL';
          let maestroLog = `EJECUTANDO ${direction} $${amount} en ${pair}...`;

          if (params?.reverseMode === 'always') {
            finalDirection = direction === 'CALL' ? 'PUT' : 'CALL';
            maestroLog = `[MODO INVERSO] EJECUTANDO ${finalDirection} $${amount} en ${pair} (Señal original: ${direction})...`;
          } else if (params?.reverseMode === 'auto' && isManipulated) {
            finalDirection = direction === 'CALL' ? 'PUT' : 'CALL';
            maestroLog = `[AUTO-REVERSO] EJECUTANDO ${finalDirection} $${amount} en ${pair} (Trampa detectada)...`;
            addLog('SENTINEL', `Manipulación en ${pair}: ${manipulationReason}. Aplicando reverso.`, 'error');
          }

          addLog('V7-MAESTRO', maestroLog, 'warning');
          playInvestSound();

          let tradeResult = await bridgeTrade({
            email: config.email,
            password: config.password,
            pair,
            direction: finalDirection,
            amount,
            accountType,
            brokerType: config.brokerType || 'iqoption'
          });

          // ─── Polling para órdenes asíncronas ─────────────────────────────────
          if (tradeResult.success && tradeResult.status === 'PENDING' && tradeResult.orderId) {
            addLog('SISTEMA', `Orden ${tradeResult.orderId} enviada. Esperando cierre (no bloqueante)...`, 'info');
            let pending = true;
            let pollRetries = 0;
            while (pending && pollRetries < 25) { // Esperar máx 2.5 min
              await new Promise(r => setTimeout(r, 6000));
              try {
                const pollRes = await bridgeTradeResult({ 
                  orderId: tradeResult.orderId ?? '',
                  email: config.email,
                  accountType: accountType,
                  brokerType: config.brokerType || 'iqoption'
                });
                if (pollRes.success && pollRes.result && pollRes.result.status === 'COMPLETED') {
                  const newResult = pollRes.result as any;
                  tradeResult = { ...tradeResult, ...newResult };
                  pending = false;
                } else if (pollRes.success === false) {
                  tradeResult = { success: false, error: pollRes.error || 'Unknown error from bridge' };
                  pending = false;
                }
              } catch (e) {
                // Ignore network errors during polling
              }
              pollRetries++;
            }
            if (pending) {
              addLog('SISTEMA', `Timeout esperando resultado de orden ${tradeResult.orderId}.`, 'error');
              isExecutingRef.current = false;
              continue;
            }
          }

          // ─── Sincronizar balance INMEDIATAMENTE tras el trade ──────────────────
          if (tradeResult.balance != null && tradeResult.balance >= 0) {
            await syncBalance(tradeResult.balance, accountType);
          }

          if (tradeResult.success) {
            const timestamp = new Date().toISOString();
            const profit = tradeResult.profit ?? 0;
            const isWin = profit > 0;
            const isLoss = profit < 0;
            const tradeStatus = isWin ? 'win' : (isLoss ? 'loss' : 'tie');

            // Actualizar contadores de sesión
            sessionProfitRef.current += profit;
            if (isWin) sessionWinsRef.current += 1;
            if (isLoss) sessionLossesRef.current += 1;
            setLiveProfit(sessionProfitRef.current);
            setLiveWins(sessionWinsRef.current);
            setLiveLosses(sessionLossesRef.current);

            if (isWin) playWinSound();
            else if (isLoss) playLossSound();

            addLog('SISTEMA', `Resultado: ${tradeStatus.toUpperCase()} | ${profit >= 0 ? '+' : ''}$${profit}`, isWin ? 'success' : 'error');

            // ─── Guardar en Firestore CON REINTENTO ──────────────────────────────
            if (currentUser && currentFirestore) {
              // Guardar trade
              const tradeSaved = await saveWithRetry(async () => {
                await addDoc(collection(currentFirestore, 'users', currentUser.uid, 'trades'), {
                  pair, direction, amount,
                  status: tradeStatus, profit,
                  orderId: tradeResult.orderId,
                  timestamp, accountType,
                  balance: tradeResult.balance,
                  broker: config.brokerType === 'binance' ? 'Binance' : 'IQ Option',
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
                
                // Actualizar stats por hora
                const hourKey = new Date().toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }) + ':00';
                const cStats = hourlyStatsRef.current[hourKey] || { wins: 0, losses: 0, profit: 0 };
                hourlyStatsRef.current[hourKey] = {
                  wins: cStats.wins + (isWin ? 1 : 0),
                  losses: cStats.losses + (isLoss ? 1 : 0),
                  profit: cStats.profit + (profit ?? 0)
                };
                
                // Actualizar stats por divisa (par)
                const pStats = pairStatsRef.current[pair] || { wins: 0, losses: 0, profit: 0 };
                pairStatsRef.current[pair] = {
                  wins: pStats.wins + (isWin ? 1 : 0),
                  losses: pStats.losses + (isLoss ? 1 : 0),
                  profit: pStats.profit + (profit ?? 0)
                };
              });
            }

            // ── Lógica Anti-Adicción: Pausa por racha de ganancias ──
            if (isWin) {
              winsSinceLastPromptRef.current += 1;
              if (winsSinceLastPromptRef.current >= 2) {
                winsSinceLastPromptRef.current = 0; // Resetear
                setIsRunning(false);
                isRunningRef.current = false;
                
                addLog('SISTEMA', `Pausa Anti-Adicción: Has logrado 2 operaciones ganadoras. Deteniendo motor para evaluación.`, 'warning');
                
                // Disparar evento para que un modal (ej. WinsPauseModal) lo recoja
                window.dispatchEvent(new CustomEvent('nt_wins_pause_prompt', {
                  detail: { wins: 2, hourlyStats: hourlyStatsRef.current }
                }));
              }
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
  }, [addLog, calculateAmount, runGuardianCheck, syncBalance]);

  // Manejar meta diaria alcanzada (Plan 15 Días)
  useEffect(() => {
    const handleDailyGoal = async (e: any) => {
      const { planPhase, planDay } = e.detail;
      const currentUser = userRef.current;
      const currentFirestore = firestoreRef.current;
      const currentBroker = brokerConfigRef.current;
      
      if (!currentUser || !currentFirestore || !planDay) return;
      
      const todayStr = new Date().toLocaleDateString();
      const todaysTrades = recentTradesRef.current.filter((t: any) => 
        t.accountType === (currentBroker?.accountType || 'demo') &&
        new Date(t.timestamp).toLocaleDateString() === todayStr
      );
      
      const realWins = todaysTrades.filter(t => t.profit > 0 || t.status === 'win').length;
      const realLosses = todaysTrades.filter(t => t.profit < 0 || t.status === 'loss').length;
      const realProfit = todaysTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
      
      const finalBalance = liveBalanceRef.current ?? 0;
      const startBalance = finalBalance - realProfit;
      const profitPercent = startBalance > 0 ? (realProfit / startBalance) * 100 : 0;
      
      try {
        // 1. Guardar informe de eficiencia
        const reportRef = collection(currentFirestore, 'users', currentUser.uid, 'reports');
        await addDoc(reportRef, {
          date: new Date().toISOString(),
          type: 'daily_goal',
          planDay,
          planPhase,
          accountType: currentBroker?.accountType || 'demo',
          profit: realProfit,
          profitPercent,
          finalBalance,
          trades: todaysTrades.length,
          wins: realWins,
          losses: realLosses,
          hourlyStats: e.detail.hourlyStats || hourlyStatsRef.current || {},
          pairStats: e.detail.pairStats || pairStatsRef.current || {}
        });
        
        // 2. Avanzar al siguiente día
        if (planDay < 15) {
          const nextDay = planDay + 1;
          const nextPreset = getPresetForDay(nextDay, (currentBroker?.accountType as any) || 'demo');
          const botParamsRef = doc(currentFirestore, 'users', currentUser.uid, 'config', 'bot_params');
          await setDoc(botParamsRef, { ...nextPreset, updatedAt: new Date().toISOString() }, { merge: true });
          
          addLog('SISTEMA', `🚀 Plan avanzado al Día ${nextDay} (Fase ${nextPreset.planPhase}) para la próxima sesión.`, 'success');
        } else {
          addLog('SISTEMA', `🏆 ¡PLAN DE 15 DÍAS COMPLETADO CON ÉXITO!`, 'success');
        }
      } catch (err) {
        console.error("Error procesando meta diaria:", err);
      }
    };
    
    const handleManualDisconnect = async () => {
      const currentUser = userRef.current;
      const currentFirestore = firestoreRef.current;
      const currentBroker = brokerConfigRef.current;
      const botParams = botParamsRef2.current;
      
      const planDay = botParams?.planDay;
      const planPhase = botParams?.planPhase;
      const accountType = currentBroker?.accountType || 'demo';
      
      if (!currentUser || !currentFirestore || !planDay) {
        window.dispatchEvent(new CustomEvent('nt_manual_disconnect_done', { detail: { success: false } }));
        return;
      }
      
      // Parar el motor inmediatamente al desconectar
      setIsRunning(false);
      setIsPreAnalyzing(false);
      
      const todayStr = new Date().toLocaleDateString();
      const todaysTrades = recentTradesRef.current.filter((t: any) => 
        t.accountType === accountType &&
        new Date(t.timestamp).toLocaleDateString() === todayStr
      );
      
      const realWins = todaysTrades.filter((t: any) => t.profit > 0 || t.status === 'win').length;
      const realLosses = todaysTrades.filter((t: any) => t.profit < 0 || t.status === 'loss').length;
      const realProfit = todaysTrades.reduce((sum: number, t: any) => sum + (t.profit || 0), 0);
      
      const finalBalance = liveBalanceRef.current ?? 0;
      const startBalance = finalBalance - realProfit;
      const profitPercent = startBalance > 0 ? (realProfit / startBalance) * 100 : 0;
      
      try {
        // ── Verificar si ya existe un reporte para hoy (evitar duplicados) ──────
        const { getDocs: getDocsLocal, where, query: queryLocal } = await import('firebase/firestore');
        const existingQ = queryLocal(
          collection(currentFirestore, 'users', currentUser.uid, 'reports'),
          where('planDay', '==', planDay),
          where('planPhase', '==', planPhase),
          where('accountType', '==', accountType),
          where('date', '>=', new Date(new Date().setHours(0,0,0,0)).toISOString())
        );
        const existingSnap = await getDocsLocal(existingQ);
        
        if (!existingSnap.empty) {
          // Ya existe un reporte de hoy — no duplicar, solo avisar
          addLog('SISTEMA', `ℹ️ Reporte del Día ${planDay} ya estaba guardado. No se duplicó.`, 'info');
          window.dispatchEvent(new CustomEvent('nt_manual_disconnect_done', { detail: { success: true, skipped: true } }));
        } else {
          // 1. Guardar informe en Firebase
          const reportRef = collection(currentFirestore, 'users', currentUser.uid, 'reports');
          await addDoc(reportRef, {
            date: new Date().toISOString(),
            type: 'manual_disconnect',
            planDay,
            planPhase,
            accountType,
            profit: realProfit,
            profitPercent,
            finalBalance,
            trades: todaysTrades.length,
            wins: realWins,
            losses: realLosses,
            hourlyStats: hourlyStatsRef.current || {},
            pairStats: pairStatsRef.current || {}
          });
          
          // 2. Avanzar de día (solo si hubo operaciones y no estamos en día 15)
          if (planDay < 15 && todaysTrades.length > 0) {
            const nextDay = planDay + 1;
            const nextPreset = getPresetForDay(nextDay, (accountType as any));
            const botParamsDoc = doc(currentFirestore, 'users', currentUser.uid, 'config', 'bot_params');
            await setDoc(botParamsDoc, { ...nextPreset, updatedAt: new Date().toISOString() }, { merge: true });
            addLog('SISTEMA', `🚀 Cierre: Reporte guardado y Plan avanzado al Día ${nextDay}.`, 'success');
          } else if (todaysTrades.length === 0) {
            addLog('SISTEMA', `📊 Reporte generado sin operaciones (día no avanzado).`, 'info');
          } else {
            addLog('SISTEMA', `🏆 ¡Plan de 15 días completado! Reporte final guardado.`, 'success');
          }
          
          window.dispatchEvent(new CustomEvent('nt_manual_disconnect_done', { detail: { success: true } }));
        }
      } catch (err) {
        console.error("Error guardando reporte manual:", err);
        window.dispatchEvent(new CustomEvent('nt_manual_disconnect_done', { detail: { success: false } }));
      }
    };

    
    window.addEventListener('nt_daily_goal_reached', handleDailyGoal);
    window.addEventListener('nt_manual_disconnect', handleManualDisconnect);
    return () => {
      window.removeEventListener('nt_daily_goal_reached', handleDailyGoal);
      window.removeEventListener('nt_manual_disconnect', handleManualDisconnect);
    };
  }, [addLog]);

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
      logs, analyses, isRunning, isPreAnalyzing, bridgeOnline, toggleEngine, forceStartEngine, activePairs: uiPairs.length > 0 ? uiPairs : (params?.pairs ?? ['EURUSD-OTC']), clearLogs, marketStatus,
      liveBalance, liveProfit, liveWins, liveLosses, sessionStartBalance,
      recentTrades,
      availablePairs, availableOtcPairs, availableRegularPairs
    }}>
      {children}
    </BotEngineContext.Provider>
  );
}
