
'use client';

import { useState, useEffect, useRef } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Activity, Zap, ShieldCheck, Loader2, Search, Info } from 'lucide-react';
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

  // Sincronización con configuración global
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  // Determinar el par activo para el monitoreo visual (tomamos el primero configurado)
  const activePair = botParams?.pairs?.[0] || 'EUR/USD';

  const fetchConsensus = async () => {
    if (isExecuting) return;

    setLoading(true);
    try {
      // AHORA PASAMOS EL PAR ACTIVO AL FLUJO DE IA
      const result = await aiConsensusMonitor({ pair: activePair });
      setData(result);
      
      const canTrade = botParams?.bot_activo && brokerConfig?.status === 'connected';
      const hasStrongConsensus = result.overallConsensus !== 'NEUTRAL' && result.consensusPercentage >= 80;

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
    if (!user || isExecuting) return;
    
    setIsExecuting(true);
    executionCooldown.current = true;
    
    const amount = botParams?.investmentPerTrade || 10;
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
          title: `OPERACIÓN IA: ${result.status === 'win' ? 'EXITOSA' : 'PERDIDA'}`,
          description: `Basado en análisis de datos de ${pair}.`,
          variant: result.status === 'win' ? 'default' : 'destructive'
        });
      }
    } catch (err) {
      console.error('Error en auto-trade:', err);
    } finally {
      setIsExecuting(false);
      // Cooldown de 60 segundos
      setTimeout(() => {
        executionCooldown.current = false;
      }, 60000);
    }
  };

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 30000); 
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status, activePair]);

  if (loading && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-10 w-10 text-primary animate-pulse" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-bold text-foreground uppercase tracking-widest">Escaneando {activePair}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Obteniendo datos OHLC...</p>
          </div>
        </div>
      </Card>
    );
  }

  const badgeLabel = data?.overallConsensus === 'CALL' ? 'COMPRA' : data?.overallConsensus === 'PUT' ? 'VENTA' : 'NEUTRAL';

  return (
    <Card className="h-full bg-card/50 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col">
      <CardHeader className="pb-4 border-b border-white/5">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Consenso Cuántico
            </CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <Search className="h-3 w-3 text-primary" />
              ACTIVO: {activePair}
            </span>
          </div>
          <Badge className={botParams?.bot_activo ? "bg-green-500/20 text-green-500 animate-pulse" : "bg-red-500/20 text-red-500"}>
            {botParams?.bot_activo ? "AUTÓNOMO" : "OFFLINE"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6 flex-1">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
           <div className="flex items-start gap-2 mb-3">
             <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
             <p className="text-[11px] text-primary/80 leading-tight italic">
               {data?.marketContext || "Analizando flujo de datos en tiempo real..."}
             </p>
           </div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Confianza del Comité</span>
             <span className="text-xl font-headline font-bold text-primary">{data?.consensusPercentage}%</span>
           </div>
           <Progress value={data?.consensusPercentage || 0} className="h-1.5" />
           <div className="mt-4 flex justify-between items-center">
             <div className={`text-lg font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
               {data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-5 w-5" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-5 w-5" /> : null}
               {badgeLabel}
             </div>
             {lastExecution && (
               <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                 Ejecutado: {lastExecution}
               </Badge>
             )}
           </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agent.recommendation === 'CALL' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {agent.recommendation === 'CALL' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold">{agent.agentName}</p>
                  <p className="text-[9px] text-muted-foreground italic leading-tight">{agent.reasoning}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {isExecuting && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
           <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
           <p className="text-lg font-headline font-bold text-primary animate-pulse uppercase">ENVIANDO ORDEN A IQ OPTION...</p>
           <p className="text-[10px] text-muted-foreground mt-2">Activo: {activePair} | Latencia: 12ms</p>
        </div>
      )}
    </Card>
  );
}
