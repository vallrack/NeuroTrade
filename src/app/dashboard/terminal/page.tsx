'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal as TerminalIcon, Activity, Zap, Database, Cpu, Loader2 } from 'lucide-react';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { TradingChart } from '@/components/dashboard/trading-chart';
import { getBridgeModeLabel } from '@/lib/bridge';

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { logs, analyses, isRunning, bridgeOnline, activePairs } = useBotEngine();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <TerminalIcon className="h-4 w-4 text-primary" />
            </div>
            <h1 className="font-headline text-lg font-bold tracking-tight">Terminal HFT Multi-Par</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {bridgeOnline ? (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              BRIDGE ONLINE
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              BRIDGE OFFLINE
            </Badge>
          )}
          
          {isRunning ? (
            <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              MOTOR ACTIVO
            </Badge>
          ) : (
            <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 gap-1.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              MOTOR PAUSADO
            </Badge>
          )}
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full flex flex-col">
        {/* GRÁFICOS MULTI-PAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {activePairs.map((pair) => {
            const analysis = analyses[pair];
            return (
              <Card key={pair} className="bg-black/60 border-white/5 shadow-2xl flex flex-col overflow-hidden group">
                <CardHeader className="p-3 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5">
                      {pair}
                    </Badge>
                    {analysis && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        RSI: {analysis.rsi?.toFixed(1) || '--'} | {(analysis.probability || 0).toFixed(0)}% Confianza
                      </span>
                    )}
                  </div>
                  {analysis && analysis.direction !== 'NONE' && (
                    <Badge className={analysis.direction === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}>
                      {analysis.direction} SEÑAL
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-0 relative flex-1 min-h-[300px]">
                  <TradingChart symbol={pair.replace('-OTC', '')} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* LOGS DE TERMINAL GLOBALES */}
        <Card className="bg-black border-white/10 shadow-2xl flex flex-col overflow-hidden h-[400px]">
          <CardHeader className="p-3 border-b border-white/10 bg-white/5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-sm font-mono text-emerald-400">LOG STREAM GLOBAL V7</CardTitle>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">BUFFER: {logs.length} EVENTOS</div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_24px] pointer-events-none" />
            
            <div 
              ref={scrollRef}
              className="h-full overflow-y-auto font-mono text-xs space-y-1.5 pr-4 custom-scrollbar relative z-10"
            >
              {logs.length === 0 && (
                <div className="text-slate-500 italic mt-2">Sintonizando flujo de datos maestro...</div>
              )}
              
              {logs.slice().reverse().map((log) => {
                let colorClass = "text-slate-400";
                let prefixClass = "text-slate-600";
                
                if (log.type === 'success') colorClass = "text-emerald-400";
                if (log.type === 'error') colorClass = "text-rose-400 font-bold";
                if (log.type === 'warning') colorClass = "text-amber-400";
                
                return (
                  <div key={log.id} className="flex gap-3 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group">
                    <span className="text-slate-600 shrink-0 select-none">
                      [{log.timestamp.toLocaleTimeString('en-US', { hour12: false })}]
                    </span>
                    <span className="font-bold shrink-0 text-indigo-400 min-w-[100px]">
                      {log.source}&gt;
                    </span>
                    <span className={colorClass}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </main>
    </>
  );
}
