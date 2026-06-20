
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Cpu, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { useUser, useFirestore, useDoc, useRTDB } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { executeTrade } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export function IACommitteeMonitor() {
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();
  const { toast } = useToast();
  
  const [data, setData] = useState<AiConsensusMonitorOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [realPrice, setRealPrice] = useState<number | null>(null);
  
  const executionCooldown = useRef(false);

  const botParamsRef = useMemo(() => firestore ? doc(firestore, 'configuracion', 'bot_params') : null, [firestore]);
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = useMemo(() => (user && firestore) ? doc(firestore, 'users', user.uid, 'config', 'broker') : null, [user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const activePair = botParams?.pairs?.[0] || 'EURUSD-OTC';

  // Escuchar Ticks reales del bot de Python desde RTDB
  useEffect(() => {
    if (!rtdb || !activePair) return;
    const tickRef = ref(rtdb, `market/ticks/${activePair.replace('/', '')}`);
    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) {
        setRealPrice(val.price);
      }
    });
    return () => unsub();
  }, [rtdb, activePair]);

  const fetchConsensus = async () => {
    try {
      const result = await aiConsensusMonitor({ pair: activePair });
      setData(result);
      setLoading(false);
      
      const botIsActive = botParams?.bot_activo;
      const brokerIsConnected = brokerConfig?.status === 'connected';
      const hasStrongConsensus = result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= 80;

      if (user && botIsActive && brokerIsConnected && hasStrongConsensus && !executionCooldown.current && !isExecuting) {
        handleAutoTrade(result.overallConsensus as 'CALL' | 'PUT');
      }
    } catch (err: any) {
      console.error('Error en monitor HFT:', err);
    }
  };

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting) return;
    
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
        toast({
          title: `ORDEN EJECUTADA: ${direction}`,
          description: `Resultado: ${result.status.toUpperCase()} | Latencia: ${result.latency}`,
          variant: result.status === 'win' ? 'default' : 'destructive'
        });
      }
    } catch (err) {
      console.error('Fallo en auto-trade:', err);
    } finally {
      setIsExecuting(false);
      setTimeout(() => {
        executionCooldown.current = false;
      }, 10000); 
    }
  };

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 3000);
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status, activePair]);

  return (
    <Card className="h-[400px] md:h-[450px] bg-card/40 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col shadow-2xl rounded-2xl">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/5 px-6">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-headline flex items-center gap-2 text-white">
              <Cpu className="h-4 w-4 text-primary" />
              NÚCLEO V7
            </CardTitle>
            <span className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
              {activePair}
            </span>
          </div>
          <div className="text-right">
             <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">FEED REAL-TIME</p>
             <p className="text-xs md:text-sm font-code text-primary font-bold">
               {realPrice ? realPrice.toFixed(5) : data?.livePrice}
             </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 px-6 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-white/5 border border-white/5 rounded-xl relative overflow-hidden shrink-0">
           <div className="flex items-start gap-3 mb-4">
             <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
             <p className="text-[10px] md:text-[11px] text-muted-foreground leading-snug italic line-clamp-2">
               {data?.marketContext || "Analizando flujo de ticks del bot..."}
             </p>
           </div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Confianza IA</span>
             <span className="text-lg font-headline font-bold text-primary">{data?.consensusPercentage}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-1.5 bg-zinc-800" />
           <div className="mt-4 flex justify-between items-center">
             <div className={`text-lg font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
               {data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-5 w-5 animate-bounce" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-5 w-5 animate-bounce" /> : null}
               {data?.overallConsensus || 'ESPERANDO...'}
             </div>
             {lastExecution && (
               <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 font-code">
                 L-EX: {lastExecution}
               </Badge>
             )}
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between group/agent hover:border-primary/30 transition-all">
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
      {isExecuting && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center z-50 animate-in fade-in">
           <Zap className="h-12 w-12 text-primary animate-bounce mb-4" />
           <p className="text-xl font-headline font-bold text-primary tracking-tighter">INYECTANDO ORDEN</p>
           <p className="text-[9px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Puente de Python Activo...</p>
        </div>
      )}
    </Card>
  );
}
