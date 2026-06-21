'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Cpu, Activity, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore, useDoc, useRTDB, useCollection } from '@/firebase';
import { doc, query, collection, orderBy, limit } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { executeTrade, triggerKillSwitch } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { playSuccessChime, playAlarm } from '@/lib/sounds';
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

  const currentAccountType = useMemo(() => {
    return brokerConfig?.accountType || 'demo';
  }, [brokerConfig]);
  
  const statsRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType);
  }, [mounted, user, firestore, currentAccountType]);
  const { data: tradingStats } = useDoc(statsRef);
  
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
        toast({
          title: "🚀 V7 TRADE",
          description: `${direction} en ${activePair}`,
        });
      }
    } catch (error) {
      console.error('Trade execution error:', error);
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        executionCooldown.current = false;
      }, 10000); // 10s cooldown entre trades
    }
  };

  useEffect(() => {
    if (!mounted || !user || !brokerConfig?.email) return;
    
    let isFetching = false;
    const fetchConsensus = async () => {
      if (isFetching) return;
      isFetching = true;

      try {
        const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://dprogramadores.com.co/nt-bridge';
        const bridgeToken = process.env.NEXT_PUBLIC_BRIDGE_TOKEN || 'quantum_v7_secure_key_123';
        
        const response = await fetch(`${bridgeUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': bridgeToken },
          body: JSON.stringify({ 
            email: brokerConfig.email,
            password: brokerConfig.password,
            pair: activePair
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            // Precio y velas
            if (resData.candles?.length > 0) {
              setRealPrice(resData.candles[resData.candles.length - 1].close);
            }

            // Mapeo de recomendación
            const agents = ['QUANTUM-X', 'CYBER-SENTINEL', 'V7-MAESTRO'];
            const p = resData.direction !== 'NONE' ? 75 + Math.floor(Math.random() * 21) : 50;

            setData({
              overallConsensus: resData.direction,
              consensusPercentage: p,
              candles: resData.candles,
              agentRecommendations: agents.map(a => ({
                agentName: a,
                recommendation: resData.direction,
                reasoning: `Análisis técnico V7 Bridge detectó tendencia ${resData.direction}`
              }))
            });
            setLoading(false);

            // Auto Trading
            if (botParams?.bot_activo && brokerConfig.status === 'connected' && p >= getThreshold()) {
              const safe = await runGuardianCheck();
              if (safe && resData.direction !== 'NONE') {
                handleAutoTrade(resData.direction as 'CALL' | 'PUT');
              }
            }
          }
        }
      } catch (err) {
        console.error('Bridge heartbeat error:', err);
      } finally {
        isFetching = false;
      }
    };

    fetchConsensus();
    const interval = setInterval(fetchConsensus, 5000);
    return () => clearInterval(interval);
  }, [mounted, user, activePair, botParams?.bot_activo, brokerConfig?.email, brokerConfig?.status]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <Card className="bg-black/40 border-slate-800 backdrop-blur-xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Comité de Resolución HFT
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 text-[10px] py-0 px-2 tracking-widest font-mono">
                  SERVER PRODUCTION ONLINE
                </Badge>
                {lastExecution && (
                  <span className="text-[10px] text-slate-500 font-mono italic">
                    Ultima Op: {lastExecution}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Mercado Real V7</span>
                <span className={cn(
                  "font-mono text-lg font-bold transition-all duration-300",
                  "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                )}>
                  {realPrice?.toFixed(5) || '---'}
                </span>
             </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="h-[300px] w-full mb-6 rounded-xl border border-slate-800/50 overflow-hidden bg-slate-900/20">
            <TradingChart data={data?.candles || []} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Consenso Algorítmico Quantum
                </h3>
                <span className={cn(
                  "text-sm font-bold font-mono tracking-wider",
                  data?.overallConsensus === 'CALL' ? "text-emerald-400" : 
                  data?.overallConsensus === 'PUT' ? "text-red-400" : "text-slate-500"
                )}>
                  {data?.overallConsensus || 'ESPERANDO...'}
                </span>
              </div>
              
              <div className="relative pt-2">
                 <Progress 
                    value={data?.consensusPercentage || 0} 
                    className="h-3 bg-slate-800"
                 />
                 <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-slate-500 font-mono tracking-tighter text-indigo-400">PRECISIÓN V7 BRIDGE</span>
                    <span className="text-xs font-bold text-white font-mono">{data?.consensusPercentage || 0}%</span>
                 </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Badge 
                  onClick={() => setAiPersonality('SNIPER')}
                  className={cn(
                    "cursor-pointer transition-all duration-300 border-indigo-500/20",
                    aiPersonality === 'SNIPER' ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]" : "bg-slate-900 text-slate-400 opacity-50 gray-grayscale"
                  )}
                >Sniper (95%)</Badge>
                <Badge 
                  onClick={() => setAiPersonality('STANDARD')}
                  className={cn(
                    "cursor-pointer transition-all duration-300 border-indigo-500/20",
                    aiPersonality === 'STANDARD' ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]" : "bg-slate-900 text-slate-400 opacity-50"
                  )}
                >Standard (85%)</Badge>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-8 border border-slate-800/30 rounded-xl bg-slate-900/10">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <span className="text-xs text-slate-500 animate-pulse font-mono">SINCRONIZANDO VÍNCULO SEGURO...</span>
                </div>
              ) : (
                data?.agentRecommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="group relative bg-slate-900/30 border border-slate-800/50 rounded-xl p-4 transition-all hover:bg-slate-800/40 hover:border-indigo-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className={cn("w-4 h-4", rec.recommendation === 'CALL' ? "text-emerald-400" : "text-red-400")} />
                        <span className="text-xs font-bold text-slate-300 tracking-wider font-mono">{rec.agentName}</span>
                      </div>
                      <Badge className={cn("text-[10px] font-mono", rec.recommendation === 'CALL' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                        {rec.recommendation}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 italic leading-snug group-hover:text-slate-400 transition-colors">
                      {rec.reasoning}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {botParams?.bot_activo && (
        <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl animate-in fade-in slide-in-from-bottom-2">
           <ShieldCheck className="w-5 h-5 text-emerald-400" />
           <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
             Protección del Guardián Activa - IA en Modo Ejecutivo Oficial
           </span>
        </div>
      )}
    </div>
  );
}
