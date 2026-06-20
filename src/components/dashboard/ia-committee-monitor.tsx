
'use client';

import { useState, useEffect, useRef } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Info, ShieldCheck, Zap, Activity } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
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
  const executionCooldown = useRef(false);

  // Obtenemos config del bot y bróker
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const fetchConsensus = async () => {
    setLoading(true);
    try {
      const result = await aiConsensusMonitor({});
      setData(result);
      
      // LÓGICA DE DECISIÓN AUTÓNOMA
      // Solo si el bot está activo y el bróker conectado
      const canTrade = botParams?.bot_activo && brokerConfig?.status === 'connected';
      const hasStrongConsensus = result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= 75;

      if (user && canTrade && hasStrongConsensus && !executionCooldown.current) {
        handleAutoTrade(result.overallConsensus as 'CALL' | 'PUT');
      }
    } catch (err: any) {
      console.error('Fallo en el monitor de IA:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user) return;
    executionCooldown.current = true;
    
    const amount = botParams?.investmentPerTrade || 10;
    const pair = botParams?.pairs?.[0] || 'EUR/USD';

    // El sistema "decide" y "ejecuta" por el usuario
    const result = await executeTrade(user.uid, {
      pair,
      direction,
      amount
    });

    if (result.success) {
      setLastExecution(new Date().toLocaleTimeString());
      toast({
        title: "IA: OPERACIÓN EJECUTADA",
        description: `El ejército ha enviado un ${direction} en ${pair}.`,
        variant: result.status === 'win' ? 'default' : 'destructive'
      });
    }

    // Cooldown para evitar ráfagas de órdenes en el mismo segundo
    setTimeout(() => {
      executionCooldown.current = false;
    }, 45000);
  };

  useEffect(() => {
    fetchConsensus();
    // Ciclo de evaluación cada 30 segundos para mayor dinamismo
    const interval = setInterval(fetchConsensus, 30000); 
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status]);

  if (loading && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px]">
        <CardContent className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Brain className="h-8 w-8 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Sincronizando Mentes Artificiales...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const badgeLabel = data?.overallConsensus === 'CALL' ? 'COMPRA' : data?.overallConsensus === 'PUT' ? 'VENTA' : 'NEUTRAL';

  return (
    <Card className="h-full bg-card/50 border-white/5 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Activity className="h-24 w-24 text-primary" />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Estado del Consenso IA
            </CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Ejecución Autónoma Nivel 4</span>
          </div>
          <div className="flex items-center gap-2">
            {botParams?.bot_activo && brokerConfig?.status === 'connected' ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1 animate-pulse uppercase text-[10px]">
                <Zap className="h-2 w-2" /> IA Activa
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase">Standby</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase text-primary tracking-wider">Potencia de Señal</span>
            <span className="text-xl font-headline font-bold">{data?.consensusPercentage}%</span>
          </div>
          <Progress value={data?.consensusPercentage || 0} className="h-3 bg-white/5" />
          <div className="mt-4 flex justify-between items-center">
             <div className="flex flex-col">
               <span className="text-[9px] text-muted-foreground uppercase">Recomendación Actual</span>
               <span className={`text-sm font-bold ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
                 {badgeLabel}
               </span>
             </div>
             {lastExecution && (
               <div className="text-right">
                 <span className="text-[9px] text-muted-foreground uppercase">Última Auto-Orden</span>
                 <p className="text-[10px] font-code text-primary">{lastExecution}</p>
               </div>
             )}
          </div>
        </div>

        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-2.5 bg-background/40 rounded-lg border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agent.recommendation === 'CALL' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {agent.recommendation === 'CALL' ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold">{agent.agentName}</p>
                  <p className="text-[10px] text-muted-foreground italic line-clamp-1">{agent.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
