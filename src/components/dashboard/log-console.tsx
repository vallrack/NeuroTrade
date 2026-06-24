'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';

export function LogConsole() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { logs: engineLogs } = useBotEngine();

  // Mapea los logs del motor al formato visual del panel
  const logs = useMemo(() => {
    return engineLogs.slice(-100).map((l: any) => {
      let direction = 'NONE';
      if (l.message.includes('CALL')) direction = 'CALL';
      if (l.message.includes('PUT')) direction = 'PUT';

      return {
        ...l,
        direction,
      };
    });
  }, [engineLogs]);

  // Auto-scroll al final cuando llegan nuevos logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="bg-black/60 border-white/5 h-[450px] flex flex-col backdrop-blur-md shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between space-y-0 bg-white/5">
        <CardTitle className="text-[10px] font-headline font-bold flex items-center gap-2 text-primary tracking-[0.2em] uppercase">
          <Cpu className="h-3 w-3 animate-pulse" />
          NÚCLEO V7: LOG STREAM
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-code text-muted-foreground uppercase">Buffer: {logs.length}/100</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-y-auto p-4 font-code text-[10px] space-y-2 custom-scrollbar bg-black/20"
        ref={scrollRef}
      >
        {logs.length === 0 && (
          <div className="text-slate-500 italic text-[10px] mt-2 animate-pulse">
            Sintonizando flujo de datos maestro...
          </div>
        )}
        {logs.map((log: any, i: number) => (
          <div key={log.id || i} className={cn(
            "log-entry transition-all duration-300 animate-in fade-in slide-in-from-left-1",
            log.direction === 'CALL' ? 'log-entry-call' : log.direction === 'PUT' ? 'log-entry-put' : 'log-entry-none'
          )}>
            <span className="text-muted-foreground/40 font-mono">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
            </span>
            {' '}
            <span className={cn("font-bold tracking-tighter", log.source ? 'text-indigo-400' : 'text-foreground')}>
              {log.source ? `${log.source}>` : ''}
            </span>
            {' '}
            <span className={cn(
              "font-mono tracking-tight",
              log.type === 'success' ? 'text-emerald-400' :
              log.type === 'error'   ? 'text-rose-400' :
              log.type === 'warning' ? 'text-amber-400' : 'text-foreground/80'
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
