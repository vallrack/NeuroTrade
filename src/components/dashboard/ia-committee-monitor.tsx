
'use client';

import { useState, useEffect, useRef } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Info, ShieldCheck, RefreshCw, Zap } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const executionCooldown = useRef(false);

  // Obtenemos config del bot y bróker
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const fetchConsensus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiConsensusMonitor({});
      setData(result);
      
      // Lógica de Ejecución Automática
      if (
        user && 
        result.overallConsensus !== 'NEUTRAL' && 
        result.consensusPercentage >= 75 && 
        botParams?.bot_activo && 
        brokerConfig?.status === 'connected' &&
        !executionCooldown.current
      ) {
        handleAutoTrade(result.overallConsensus);
      }
    } catch (err: any) {
      console.error('Fallo en el monitor de IA:', err);
      setError('Fallo de conexión con el Ejército de IA.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user) return;
    executionCooldown.current = true;
    
    const amount = botParams?.investmentPerTrade || 10;
    const pair = botParams?.pairs?.[0] || 'EUR/USD';

    const result = await executeTrade(user.uid, {
      pair,
      direction,
      amount
    });

    if (result.success) {
      toast({
        title: "OPERACIÓN EJECUTADA",
        description: `${direction} en ${pair} por $${amount}. Resultado: ${result.status.toUpperCase()}`,
        variant: result.status === 'win' ? 'default' : 'destructive'
      });
    }

    // Cooldown de 30 segundos para evitar sobre-operación en el mismo consenso
    setTimeout(() => {
      executionCooldown.current = false;
    }, 30000);
  };

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 60000); 
    return () => clearInterval(interval);
  }, [user, botParams?.bot_activo, brokerConfig?.status]);

  if (loading && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px]">
        <CardContent className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Brain className="h-8 w-8 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Sincronizando Ejército de IA...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const badgeLabel = data?.overallConsensus === 'CALL' ? 'COMPRA' : data?.overallConsensus === 'PUT' ? 'VENTA' : 'NEUTRAL';

  return (
    <Card className="h-full bg-card/50 border-white/5 backdrop-blur-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-headline flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Consenso del Ejército de IA
          </CardTitle>
          <div className="flex items-center gap-2">
            {botParams?.bot_activo && brokerConfig?.status === 'connected' && (
              <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-500 gap-1 animate-pulse">
                <Zap className="h-2 w-2" /> AUTO
              </Badge>
            )}
            <Badge variant={data?.overallConsensus === 'CALL' ? 'default' : data?.overallConsensus === 'PUT' ? 'destructive' : 'secondary'} className="font-headline">
              {badgeLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Confianza del Comité</span>
            <span className="font-bold">{data?.consensusPercentage}%</span>
          </div>
          <Progress value={data?.consensusPercentage || 0} className="h-2" />
        </div>

        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
          {data?.agentRecommendations.map((agent, i) => (
            <div key={i} className="p-3 bg-background/50 rounded-lg border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                {agent.recommendation === 'CALL' ? (
                  <ArrowUpCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <ArrowDownCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="max-w-[150px] md:max-w-none">
                  <p className="text-sm font-medium">{agent.agentName}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 italic">{agent.reasoning}</p>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] bg-popover border-white/10">
                    <p className="text-xs">{agent.reasoning}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
