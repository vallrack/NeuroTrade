'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Cpu, Activity, Zap, Loader2 } from 'lucide-react';
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
  const cleanPair = useMemo(() => activePair.replace('/', '').replace('-', '').trim(), [activePair]);

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
        toast({
          title: `BRIDGE V7: EJECUCIÓN EXITOSA`,
          description: `Señal ${direction} en ${activePair}. Balance actualizado.`,
        });
      }
    } catch (err) {
      console.error('Error en ejecución del puente:', err);
    } finally {
      setIsExecuting(false);
      // Cooldown técnico mínimo para estabilidad de red
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
        
        // Consenso Maestro: Solo opera si la IA está por encima del 85% de confianza
        if (botIsActive && brokerIsConnected && result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= 85) {
          handleAutoTrade(result.overallConsensus as 'CALL' | 'PUT');
        }
      } catch (err) {
        console.error('Monitor HFT error:', err);
      }
    };

    fetchConsensus();
    const interval = setInterval(fetchConsensus, 3000); // Análisis continuo cada 3s
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status, activePair]);

  return (
    <Card className="h-[400px] md:h-[450px] bg-card/40 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col shadow-2xl rounded-2xl">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/5 px-6">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-headline flex items-center gap-2 text-white uppercase">
              <Cpu className="h-4 w-4 text-primary" />
              Núcleo Maestro IA
            </CardTitle>
            <span className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
              {activePair} BRIDGE ACTIVE
            </span>
          </div>
          <div className="text-right">
             <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">REAL PRICE</p>
             <p className="text-xs md:text-sm font-code text-primary font-bold">
               {realPrice ? realPrice.toFixed(5) : 'SYNCING...'}
             </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 px-6 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 bg-white/5 border border-white/5 rounded-xl relative overflow-hidden shrink-0">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Consenso de IA</span>
             <span className="text-lg font-headline font-bold text-primary">{data?.consensusPercentage || 0}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-1.5 bg-zinc-800" />
           <div className="mt-4 flex justify-between items-center">
             <div className={`text-lg font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
               {isExecuting ? <Loader2 className="h-5 w-5 animate-spin" /> : data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-5 w-5 animate-bounce" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-5 w-5 animate-bounce" /> : <Activity className="h-5 w-5 animate-pulse" />}
               {isExecuting ? 'EJECUTANDO...' : (data?.overallConsensus || 'ESCANEO...')}
             </div>
             {lastExecution && (
               <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 font-code">
                 L-EXEC: {lastExecution}
               </Badge>
             )}
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
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
