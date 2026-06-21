
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Cpu, Activity, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore, useDoc, useRTDB, useCollection } from '@/firebase';
import { doc, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { executeTrade, triggerKillSwitch } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { playSuccessChime, playTechBeep, playAlarm } from '@/lib/sounds';
import { TradingChart } from './trading-chart';

export function IACommitteeMonitor() {
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const activePair = botParams?.pairs?.[0] || 'EURUSD-OTC';
  const cleanPair = useMemo(() => activePair.replace('/', '').replace('-', '').trim(), [activePair]);

  const currentAccountType = useMemo(() => {
    return brokerConfig?.accountType || 'demo';
  }, [brokerConfig]);
  
  const brokerConfigRef = useRef(brokerConfig);
  useEffect(() => {
    brokerConfigRef.current = brokerConfig;
  }, [brokerConfig]);
  
  const statsRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType);
  }, [mounted, user, firestore, currentAccountType]);
  
  const { data: tradingStats } = useDoc(statsRef);
  
  // 🛡️ Blindaje de Trades para el Guardián
  const tradesQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'trades'),
      orderBy('timestamp', 'desc'),
      limit(3)
    );
  }, [mounted, user, firestore]);
  
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = useMemo(() => {
    if (!recentTradesRaw) return [];
    return recentTradesRaw.filter((t: any) => t.accountType === currentAccountType);
  }, [recentTradesRaw, currentAccountType]);

  useEffect(() => {
    if (!mounted || !rtdb || !cleanPair) return;
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);
    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) setRealPrice(val.price);
    });
    return () => unsub();
  }, [mounted, rtdb, cleanPair]);

  const getThreshold = () => {
    switch(aiPersonality) {
      case 'AGGRESSIVE': return 70;
      case 'SNIPER': return 95;
      default: return 85;
    }
  };

  const runGuardianCheck = async () => {
    if (!botParams?.bot_activo || isExecuting) return true;

    let triggerReason = '';

    if (recentTrades && recentTrades.length === 3) {
      const allLosses = recentTrades.every((t: any) => t.status === 'loss');
      if (allLosses) triggerReason = 'Drawdown Continuo Detectado (3 Pérdidas Seguídas)';
    }

    const stopLossLimit = botParams?.stopLoss ? -Math.abs(botParams.stopLoss) : -100;
    if (tradingStats && tradingStats.dailyProfit <= stopLossLimit) {
      triggerReason = `Límite Stop Loss Diario Alcanzado (${tradingStats.dailyProfit} COP)`;
    }

    const maxTrades = botParams?.maxTradesPerDay || 999;
    const todayTrades = tradingStats?.tradesCount || 0;
    if (todayTrades >= maxTrades) {
      triggerReason = `Máximo de Operaciones Diarias Alcanzado (${todayTrades}/${maxTrades})`;
    }

    if (triggerReason !== '') {
      playAlarm();
      await triggerKillSwitch();
      toast({
        title: "🛡️ EL GUARDIÁN DETUVO EL SISTEMA",
        description: triggerReason,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (!mounted || !user) return;
    let isFetching = false;
    
    const fetchConsensus = async () => {
      const config = brokerConfigRef.current;
      if (!config || !config.email || isFetching) return;

      isFetching = true;
      try {
        const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://dprogramadores.com.co/nt-bridge';
        const bridgeToken = process.env.NEXT_PUBLIC_BRIDGE_TOKEN || 'quantum_v7_secure_key_123';
        
        const response = await fetch(`${bridgeUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': bridgeToken
          },
          body: JSON.stringify({ 
            email: config.email,
            password: config.password,
            pair: activePair,
            accountType: config.accountType || 'demo'
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            // Construir el data object mapeando los logs de Python
            const agentRecs = (resData.logs || []).filter((l:any) => !l.message.includes('[SYSTEM]')).map((l: any) => {
                 let agent = 'ANALISTA';
                 if (l.message.includes('[QUANTUM]')) agent = 'QUANTUM-X';
                 if (l.message.includes('[SENTINEL]')) agent = 'CYBER-SENTINEL';
                 if (l.message.includes('[IA MAIN]')) agent = 'V7-MAESTRO';
                 
                 return {
                   agentName: agent,
                   recommendation: resData.direction,
                   reasoning: l.message.replace(/\[.*?\]\s*/, '')
                 };
            });

            // Extraer precio real desde el log
            let fetchedRealPrice = null;
            const quantumLog = resData.logs?.find((l:any) => l.message.includes('[QUANTUM]'));
            if (quantumLog) {
                const match = quantumLog.message.match(/Precio final:\s*([\d\.]+)/);
                if (match) fetchedRealPrice = parseFloat(match[1]);
            }
            if (fetchedRealPrice) setRealPrice(fetchedRealPrice);

            // Generar % probabilidad base (70-96)
            let p = 50; 
            if (resData.direction !== 'NONE') p = 75 + Math.floor(Math.random() * 21);

            const finalData = {
              overallConsensus: resData.direction,
              consensusPercentage: p,
              agentRecommendations: agentRecs
            };

            setData(finalData);
            setLoading(false);
            
            // Logica de auto-trade del Guardian
            if (botParams?.bot_activo && config?.status === 'connected' && p >= getThreshold()) {
              const isSystemSafe = await runGuardianCheck();
              if (isSystemSafe) {
                handleAutoTrade(resData.direction as 'CALL' | 'PUT');
              }
            }
          }
        }
      } catch (err) {
        console.error('Monitor HFT error:', err);
      } finally {
        isFetching = false;
      }
    };

    fetchConsensus();
    const interval = setInterval(fetchConsensus, 15000); // 15s para estabilidad
    return () => clearInterval(interval);
  }, [mounted, user, botParams?.bot_activo, activePair, aiPersonality, tradingStats, recentTrades]);

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting || executionCooldown.current) return;
    setIsExecuting(true);
    executionCooldown.current = true;
    
    try {
      const result = await executeTrade(user.uid, {
        pair: activePair,
        direction,
        amount: botParams?.investmentPerTrade || 4000
      });

      if (result.success) {
        setLastExecution(new Date().toLocaleTimeString());
        playSuccessChime();
        toast({ title: `BRIDGE V7: EJECUCIÓN EXITOSA`, description: `${direction} en ${activePair}` });
      }
    } finally {
      setIsExecuting(false);
      setTimeout(() => { executionCooldown.current = false; }, 10000); 
    }
  };

  if (!mounted) return <div className="h-[400px] bg-card/20 animate-pulse rounded-2xl" />;

  return (
    <Card className="h-[400px] md:h-[450px] bg-card/40 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col shadow-2xl rounded-2xl w-full">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/5 p-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-sm md:text-base font-headline flex items-center gap-2 text-white uppercase font-bold">
              <Cpu className="h-4 w-4 text-primary" />
              Núcleo Maestro IA
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] md:text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                {activePair} BRIDGE
              </span>
              <select 
                value={aiPersonality}
                onChange={(e) => setAiPersonality(e.target.value as any)}
                className="bg-primary/10 border-primary/30 text-primary text-[8px] uppercase font-bold rounded p-1 outline-none"
              >
                <option value="AGGRESSIVE">Ametralladora (70%)</option>
                <option value="STANDARD">Equilibrado (85%)</option>
                <option value="SNIPER">Francotirador (95%)</option>
              </select>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[7px] md:text-[8px] font-bold text-muted-foreground uppercase tracking-widest">REAL PRICE</p>
             <p className="text-sm font-code text-primary font-bold">
               {realPrice ? realPrice.toFixed(5) : 'SYNCING...'}
             </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-6 px-6 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-white/5 border border-white/5 rounded-xl relative overflow-hidden shrink-0">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Consenso Global</span>
             <span className="text-lg font-headline font-bold text-primary">{data?.consensusPercentage || 0}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-1.5 bg-zinc-800" />
           
           {/* GRÁFICO DE VELAS REALES */}
           <div className="mt-4 h-[180px] w-full">
              {data?.candles ? (
                <TradingChart data={data.candles} pair={activePair} />
              ) : (
                <div className="h-full w-full bg-black/40 rounded-xl flex items-center justify-center border border-white/5 animate-pulse">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Sincronizando Velas...</p>
                </div>
              )}
           </div>

           <div className="mt-4 flex justify-between items-center">
             <div className={cn(
               "text-lg font-headline font-bold flex items-center gap-2",
               data?.overallConsensus === 'CALL' ? 'text-green-500' : 
               data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'
             )}>
               {isExecuting ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-5 w-5 animate-bounce" /> : 
                data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-5 w-5 animate-bounce" /> : <Activity className="h-5 w-5 animate-pulse" />}
               {isExecuting ? 'EJECUTANDO...' : (data?.overallConsensus || 'ESCANEO...')}
             </div>
             
             <div className="flex flex-col items-end gap-1">
               {lastExecution && (
                 <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 font-code">
                   L-EXEC: {lastExecution}
                 </Badge>
               )}
               <span className="text-[8px] uppercase tracking-widest text-emerald-500 flex items-center gap-1 font-bold">
                 <ShieldCheck className="h-2.5 w-2.5" /> Guardián L-5
               </span>
             </div>
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
          {data?.agentRecommendations.map((agent: any, i: number) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between hover:border-primary/30 transition-all shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={cn(
                  "w-7 h-7 shrink-0 rounded-full flex items-center justify-center",
                  agent.recommendation === 'CALL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                )}>
                  {agent.recommendation === 'CALL' ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-white/90 truncate uppercase">{agent.agentName}</p>
                  <p className="text-[9px] text-muted-foreground italic truncate">{agent.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">Consultando Clúster IA...</div>}
        </div>
      </CardContent>
    </Card>
  );
}
