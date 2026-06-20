
'use client';

import { useState, useEffect } from 'react';
import { aiConsensusMonitor, type AiConsensusMonitorOutput } from '@/ai/flows/ai-consensus-monitor-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowUpCircle, ArrowDownCircle, Info, ShieldCheck, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export function IACommitteeMonitor() {
  const [data, setData] = useState<AiConsensusMonitorOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsensus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiConsensusMonitor({});
      setData(result);
    } catch (err: any) {
      console.error('Fallo en el monitor de IA:', err);
      setError('Fallo de conexión con el Ejército de IA.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 60000); 
    return () => clearInterval(interval);
  }, []);

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

  if (error && !data) {
    return (
      <Card className="h-full bg-card/50 border-white/5 min-h-[400px]">
        <CardContent className="h-full flex items-center justify-center p-6 text-center">
          <div className="space-y-4">
            <p className="text-sm text-destructive font-bold">{error}</p>
            <Button onClick={fetchConsensus} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar Conexión
            </Button>
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
          <Badge variant={data?.overallConsensus === 'CALL' ? 'default' : data?.overallConsensus === 'PUT' ? 'destructive' : 'secondary'} className="font-headline">
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Umbral de Confianza Cuántica</span>
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
