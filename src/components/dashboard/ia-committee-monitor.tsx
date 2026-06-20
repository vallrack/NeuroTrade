'use client';

import { useState, useEffect, useRef } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Activity, Zap, ShieldCheck, Loader2, Info, Cpu, TrendingUp, BarChart3, RefreshCw } from 'lucide-react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { executeTrade } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export function IACommitteeMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [data, setData] = useState<AiConsensusMonitorOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const executionCooldown = useRef(false);

  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const activePair = botParams?.pairs?.[0] || 'EURUSD-OTC';

  const fetchConsensus = async () => {
    // En HFT, la IA nunca se detiene, incluso durante la ejecución
    try {
      const result = await aiConsensusMonitor({ pair: activePair });
      setData(result);
      setLoading(false);
      
      const canTrade = botParams?.bot_activo && brokerConfig?.status === 'connected';
      const hasStrongConsensus = result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= 80;

      if (user && canTrade && hasStrongConsensus && !executionCooldown.current && !isExecuting) {
        handleAutoTrade(result.overallConsensus as 'CALL' | 'PUT');
      }
    } catch (err: any) {
      console.error('Fallo en el monitor de IA:', err);
    }
  };

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting) return;
    
    setIsExecuting(true);
    executionCooldown.current = true;
    
    const amount = botParams?.investmentPerTrade || 4000;
    const pair = activePair;

    try {
      const result = await executeTrade(user.uid, {
        pair,
        direction,
        amount
      });

      if (result.success) {
        setLastExecution(new Date().toLocaleTimeString());
        toast({
          title: `EJECUCIÓN V7: ${result.status === 'win' ? 'PROFIT' : 'LOSS'}`,
          description: `Orden de $${amount} enviada al túnel IQ.`,
          variant: result.status === 'win' ? 'default' : 'destructive'
        });
      }
    } catch (err) {
      console.error('Error en auto-trade:', err);
    } finally {
      setIsExecuting(false);
      // Cooldown reducido para HFT (5 segundos)
      setTimeout(() => {
        executionCooldown.current = false;
      }, 5000);
    }
  };

  useEffect(() => {
    fetchConsensus();
    // FRECUENCIA ULTRA-ALTA: Actualización cada 3 segundos
    const interval = setInterval(fetchConsensus, 3000);
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status, activePair]);

  if (loading && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground animate-pulse">Sincronizando ráfaga HFT...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-card/50 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col shadow-2xl">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-headline flex items-center gap-2 text-white">
              <Cpu className="h-5 w-5 text-primary" />
              NÚCLEO MAESTRO V7
            </CardTitle>
            <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              FEED: {activePair}
            </span>
          </div>
          <div className="text-right">
             <p className="text-[9px] font-bold text-muted-foreground uppercase">Ticker HFT</p>
             <p className="text-sm font-code text-primary font-bold animate-pulse">{data?.livePrice}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6 flex-1 bg-black/20">
        <div className="p-4 bg-zinc-900/50 border border-white/10 rounded-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-2 opacity-10">
              <BarChart3 className="h-12 w-12" />
           </div>
           <div className="flex items-start gap-2 mb-3">
             <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
             <p className="text-[11px] text-muted-foreground leading-tight italic min-h-[32px]">
               {data?.marketContext || "Analizando ráfaga de datos..."}
             </p>
           </div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Consenso del Comité</span>
             <span className="text-xl font-headline font-bold text-primary">{data?.consensusPercentage}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-2 bg-zinc-800" />
           <div className="mt-4 flex justify-between items-center">
             <div className={`text-xl font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
               {data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-6 w-6 animate-bounce" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-6 w-6 animate-bounce" /> : null}
               {data?.overallConsensus}
             </div>
             {lastExecution && (
               <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5 font-code">
                 L-EXEC: {lastExecution}
               </Badge>
             )}
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto max-h-[180px] custom-scrollbar pr-1">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-3 bg-zinc-900/30 rounded-lg border border-white/5 flex items-center justify-between group/agent hover:border-primary/40 transition-all animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agent.recommendation === 'CALL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {agent.recommendation === 'CALL' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-white/90">{agent.agentName}</p>
                  <p className="text-[9px] text-muted-foreground italic leading-tight">{agent.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {isExecuting && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
           <Zap className="h-16 w-16 text-primary animate-bounce mb-4" />
           <p className="text-2xl font-headline font-bold text-primary animate-pulse tracking-tighter">ORDEN V7 EN CURSO</p>
           <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Inyectando capital en túnel IQ...</p>
        </div>
      )}
    </Card>
  );
}
