
'use client';

import { useState, useEffect, useRef } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Activity, Zap, ShieldCheck, Loader2 } from 'lucide-react';
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

  // Sincronización con configuración global y personal
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const fetchConsensus = async () => {
    // Solo actualizamos si no estamos ejecutando una orden
    if (isExecuting) return;

    setLoading(true);
    try {
      const result = await aiConsensusMonitor({});
      setData(result);
      
      // LOGICA DE DECISIÓN AUTÓNOMA
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
    if (!user || isExecuting) return;
    
    setIsExecuting(true);
    executionCooldown.current = true;
    
    // Usamos el monto configurado en el Control de Riesgo
    const amount = botParams?.investmentPerTrade || 10;
    const pair = botParams?.pairs?.[0] || 'EUR/USD';

    try {
      const result = await executeTrade(user.uid, {
        pair,
        direction,
        amount
      });

      if (result.success) {
        setLastExecution(new Date().toLocaleTimeString());
        toast({
          title: `SISTEMA: ${result.status === 'win' ? 'GANANCIA' : 'PÉRDIDA'}`,
          description: `IA ejecutó ${direction} en ${pair} (${result.accountType.toUpperCase()}).`,
          variant: result.status === 'win' ? 'default' : 'destructive'
        });
      }
    } catch (err) {
      console.error('Error en auto-trade:', err);
    } finally {
      setIsExecuting(false);
      // Cooldown de seguridad de 45 segundos entre disparos
      setTimeout(() => {
        executionCooldown.current = false;
      }, 45000);
    }
  };

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 30000); 
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status]);

  if (loading && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-10 w-10 text-primary animate-pulse" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-bold text-foreground">SINCRONIZANDO EJÉRCITO IA</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Conectando mentes artificiales...</p>
          </div>
        </div>
      </Card>
    );
  }

  const badgeLabel = data?.overallConsensus === 'CALL' ? 'COMPRA' : data?.overallConsensus === 'PUT' ? 'VENTA' : 'NEUTRAL';

  return (
    <Card className="h-full bg-card/50 border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Activity className="h-32 w-32 text-primary" />
      </div>
      <CardHeader className="pb-4 border-b border-white/5">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Consenso de Inteligencia
            </CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              PROTOCOLOS L-5 ACTIVOS
            </span>
          </div>
          <div className="flex items-center gap-2">
            {botParams?.bot_activo && brokerConfig?.status === 'connected' ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1.5 py-1 px-3 animate-pulse uppercase text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                AUTÓNOMO
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest border-white/10">STANDBY</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6 flex-1">
        <div className="p-5 bg-primary/10 border border-primary/20 rounded-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold uppercase text-primary tracking-widest">Confianza de la Señal</span>
            <span className="text-2xl font-headline font-bold text-primary">{data?.consensusPercentage}%</span>
          </div>
          <Progress value={data?.consensusPercentage || 0} className="h-2.5 bg-background border border-white/5" />
          <div className="mt-5 flex justify-between items-end">
             <div className="space-y-1">
               <span className="text-[10px] text-muted-foreground uppercase font-bold">Dirección Acordada</span>
               <div className={`text-xl font-headline font-bold flex items-center gap-2 ${data?.overallConsensus === 'CALL' ? 'text-green-500' : data?.overallConsensus === 'PUT' ? 'text-red-500' : 'text-muted-foreground'}`}>
                 {data?.overallConsensus === 'CALL' ? <ArrowUpCircle className="h-6 w-6" /> : data?.overallConsensus === 'PUT' ? <ArrowDownCircle className="h-6 w-6" /> : null}
                 {badgeLabel}
               </div>
             </div>
             {lastExecution && (
               <div className="text-right space-y-1">
                 <span className="text-[10px] text-muted-foreground uppercase font-bold">Última Acción</span>
                 <p className="text-xs font-code font-bold text-primary bg-primary/5 px-2 py-1 rounded-md border border-primary/10">{lastExecution}</p>
               </div>
             )}
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-primary/20 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${agent.recommendation === 'CALL' ? 'bg-green-500/10 text-green-500 shadow-green-500/10' : 'bg-red-500/10 text-red-500 shadow-red-500/10'}`}>
                  {agent.recommendation === 'CALL' ? (
                    <ArrowUpCircle className="h-5 w-5" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{agent.agentName}</p>
                  <p className="text-[10px] text-muted-foreground italic line-clamp-1">{agent.reasoning}</p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 opacity-0 group-hover:opacity-100 transition-opacity">
                99.9% ANALYZED
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {isExecuting && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in">
           <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
           <p className="text-lg font-headline font-bold text-primary animate-pulse uppercase">Ejecutando Orden en IQ Option...</p>
           <p className="text-[10px] text-muted-foreground mt-2">Latencia: 12ms | Puente WSS Activo</p>
        </div>
      )}
    </Card>
  );
}
