'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { aiConsensusMonitor } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Cpu, Activity, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore, useDoc, useRTDB, useCollection } from '@/firebase';
import { doc, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { executeTrade, triggerKillSwitch } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

import { playSuccessChime, playTechBeep, playAlarm } from '@/lib/sounds';

export function IACommitteeMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();
  const { toast } = useToast();
  
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [realPrice, setRealPrice] = useState<number | null>(null);
  const [aiPersonality, setAiPersonality] = useState<'AGGRESSIVE' | 'STANDARD' | 'SNIPER'>('STANDARD');
  
  const executionCooldown = useRef(false);
  const botParamsRef = useMemo(() => firestore ? doc(firestore, 'configuracion', 'bot_params') : null, [firestore]);
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = useMemo(() => (user && firestore) ? doc(firestore, 'users', user.uid, 'config', 'broker') : null, [user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const activePair = botParams?.pairs?.[0] || 'EURUSD-OTC';
  const cleanPair = useMemo(() => activePair.replace('/', '').replace('-', '').trim(), [activePair]);

  // Guardian Dependencies
  const currentAccountType = brokerConfig?.accountType || 'demo';
  const statsRef = useMemo(() => (user && firestore) ? doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType) : null, [user, firestore, currentAccountType]);
  const { data: tradingStats } = useDoc(statsRef);
  
  // Guardián - Revisión de últimos 3 trades (Anti-Rachas)
  const tradesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'trades'),
      where('accountType', '==', currentAccountType),
      orderBy('timestamp', 'desc'),
      limit(3)
    );
  }, [user, firestore, currentAccountType]);
  const { data: recentTrades } = useCollection(tradesQuery);

  // Feed de Ticks Real-Time desde el Puente
  useEffect(() => {
    if (!rtdb || !cleanPair) return;
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);
    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) setRealPrice(val.price);
    });
    return () => unsub();
  }, [rtdb, cleanPair]);

  const getThreshold = () => {
    switch(aiPersonality) {
      case 'AGGRESSIVE': return 70;
      case 'SNIPER': return 95;
      default: return 85;
    }
  };

  // 🛡️ GUARDIAN AUTÓNOMO (Ejecución silenciosa de protección)
  const runGuardianCheck = async () => {
    if (!botParams?.bot_activo || isExecuting) return true; // Todo OK

    let triggerReason = '';

    // 1. Drawdown Continuo (3 pérdidas en cadena)
    if (recentTrades && recentTrades.length === 3) {
      const allLosses = recentTrades.every((t: any) => t.status === 'loss');
      if (allLosses) triggerReason = 'Drawdown Continuo Detectado (3 Pérdidas Seguídas)';
    }

    // 2. Pérdida Máxima Diaria (dinámica, toma el stopLoss configurado en Núcleo V7)
    const stopLossLimit = botParams?.stopLoss ? -Math.abs(botParams.stopLoss) : -100;
    if (tradingStats && tradingStats.dailyProfit <= stopLossLimit) {
      triggerReason = `Límite Stop Loss Diario Alcanzado (${tradingStats.dailyProfit} COP)`;
    }

    // 3. Máximo de operaciones por día
    const maxTrades = botParams?.maxTradesPerDay || 999;
    const todayTrades = tradingStats?.tradesCount || 0;
    if (todayTrades >= maxTrades) {
      triggerReason = `Máximo de Operaciones Diarias Alcanzado (${todayTrades}/${maxTrades})`;
    }

    // 4. Ventanas Operativas (Horarios)
    if (botParams?.schedules && botParams.schedules.length > 0) {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentTimeInMinutes = (currentH * 60) + currentM;

      const isInWindow = botParams.schedules.some((s: {start: string, end: string}) => {
        const [startH, startM] = s.start.split(':').map(Number);
        const [endH, endM] = s.end.split(':').map(Number);
        const startTimeInMinutes = (startH * 60) + startM;
        const endTimeInMinutes = (endH * 60) + endM;
        
        // Manejo de horarios que cruzan la medianoche (ej: 23:00 a 02:00)
        if (startTimeInMinutes <= endTimeInMinutes) {
          return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
        } else {
          return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
        }
      });

      if (!isInWindow) triggerReason = 'Fuera de Ventana Operativa Autorizada';
    }

    // Si el Guardián encuentra peligro, Aborta el Sistema
    if (triggerReason !== '') {
      console.warn('⚠️ GUARDIÁN ACTIVADO: ' + triggerReason);
      playAlarm();
      await triggerKillSwitch();
      toast({
        title: "🛡️ EL GUARDIÁN DETUVO EL SISTEMA",
        description: triggerReason + " - Auto-Trading Desactivado por Seguridad.",
        variant: "destructive",
      });
      return false; // Bloquear permisos de ejecución
    }

    return true; // Sistema Seguro
  };

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting || executionCooldown.current) return;
    
    setIsExecuting(true);
    executionCooldown.current = true;
    
    const amount = botParams?.investmentPerTrade || 4000;

    try {
      const result = await executeTrade(user.uid, {
        pair: activePair,
        direction,
        amount
      });

      if (result.success) {
        setLastExecution(new Date().toLocaleTimeString());
        playSuccessChime(); // Efecto de sonido Cuántico!
        toast({
          title: `BRIDGE V7: EJECUCIÓN EXITOSA`,
          description: `Señal ${direction} en ${activePair}. Balance actualizado.`,
        });
      }
    } catch (err) {
      console.error('Error en ejecución del puente:', err);
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        executionCooldown.current = false;
      }, 5000); 
    }
  };

  useEffect(() => {
    const fetchConsensus = async () => {
      try {
        const result = await aiConsensusMonitor({ pair: activePair });
        setData(result);
        setLoading(false);
        
        const botIsActive = botParams?.bot_activo;
        const brokerIsConnected = brokerConfig?.status === 'connected';
        const currentThreshold = getThreshold();
        
        // Consenso Maestro: Opera según Personalidad
        if (botIsActive && brokerIsConnected && result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= currentThreshold) {
          const isSystemSafe = await runGuardianCheck();
          if (isSystemSafe) {
            handleAutoTrade(result.overallConsensus as 'CALL' | 'PUT');
          }
        } else if (botIsActive && brokerIsConnected) {
          // Monitorizamos de forma constante el riesgo incluso si no ejecutamos
          await runGuardianCheck();
        }
      } catch (err) {
        console.error('Monitor HFT error:', err);
      }
    };

    fetchConsensus();
    const interval = setInterval(fetchConsensus, 3000); // Análisis continuo cada 3s
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status, activePair, aiPersonality, tradingStats, recentTrades]);

  return (
    <Card className="h-[400px] md:h-[450px] bg-card/40 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col shadow-2xl rounded-2xl w-full">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/5 p-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-sm md:text-base font-headline flex items-center gap-2 text-white uppercase">
              <Cpu className="h-4 w-4 text-primary" />
              Núcleo Maestro IA
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[8px] md:text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                {activePair} BRIDGE
              </span>
              <select 
                value={aiPersonality}
                onChange={(e) => {
                  setAiPersonality(e.target.value as any);
                  playTechBeep();
                }}
                className="bg-primary/10 border-primary/30 text-primary text-[8px] md:text-[9px] uppercase font-bold outline-none rounded p-1 cursor-pointer w-[110px] md:w-auto"
              >
                <option value="AGGRESSIVE">Ametralladora (70%)</option>
                <option value="STANDARD">Equilibrado (85%)</option>
                <option value="SNIPER">Francotirador (95%)</option>
              </select>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
             <p className="text-[7px] md:text-[8px] font-bold text-muted-foreground uppercase tracking-widest">REAL PRICE</p>
             <p className="text-sm md:text-base font-code text-primary font-bold">
               {realPrice ? realPrice.toFixed(5) : 'SYNCING...'}
             </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 px-6 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-white/5 border border-white/5 rounded-xl relative overflow-hidden shrink-0">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Consenso de IA ({aiPersonality})</span>
             <span className="text-lg font-headline font-bold text-primary">{data?.consensusPercentage || 0}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-1.5 bg-zinc-800" />
           <div className="mt-4 flex justify-between items-center">
             <div className={`text-lg font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
               {isExecuting ? <Loader2 className="h-5 w-5 animate-spin" /> : data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-5 w-5 animate-bounce" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-5 w-5 animate-bounce" /> : <Activity className="h-5 w-5 animate-pulse" />}
               {isExecuting ? 'EJECUTANDO...' : (data?.overallConsensus || 'ESCANEO...')}
             </div>
             
             <div className="flex flex-col items-end gap-1">
               {lastExecution && (
                 <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 font-code">
                   L-EXEC: {lastExecution}
                 </Badge>
               )}
               <span className="text-[8px] uppercase tracking-widest text-emerald-500 flex items-center gap-1 font-bold">
                 <ShieldCheck className="h-2.5 w-2.5" /> Guardián Activo
               </span>
             </div>
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {data?.agentRecommendations.map((agent: any, i: number) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${agent.recommendation === 'CALL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {agent.recommendation === 'CALL' ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  <p className="text-[10px] font-bold text-white/90 truncate">{agent.agentName}</p>
                  <p className="text-[9px] text-muted-foreground italic truncate">{agent.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
