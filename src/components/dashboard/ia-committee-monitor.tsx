'use client';

import { useState, useEffect } from 'react';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Activity, Loader2 } from 'lucide-react';
import { TradingChart } from './trading-chart';

export function IACommitteeMonitor() {
  const [mounted, setMounted] = useState(false);
  const { logs, analyses, isRunning, toggleEngine, bridgeOnline, activePairs } = useBotEngine();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tomamos el par más recientemente actualizado para el Dashboard
  const mainPair = Object.entries(analyses).length > 0 
    ? Object.entries(analyses).sort((a, b) => {
        const timeA = a[1].lastUpdated?.getTime() || 0;
        const timeB = b[1].lastUpdated?.getTime() || 0;
        return timeB - timeA;
      })[0][0]
    : (activePairs[0] || 'EURUSD-OTC');
    
  const analysis = analyses[mainPair];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/30 border-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
          <CardHeader className="border-b border-white/5 relative z-10 flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl">
                <Cpu className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-headline tracking-tight">Monitor V7</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                    {mainPair}
                  </Badge>
                  {isRunning ? (
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      EJECUTANDO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      PAUSADO
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={toggleEngine}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-lg ${
                isRunning 
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
              }`}
            >
              {isRunning ? 'APAGAR MOTOR' : 'ENCENDER MOTOR'}
            </button>
          </CardHeader>
          <CardContent className="p-0 h-[400px]">
            <TradingChart data={analysis?.candles || []} pair={mainPair} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-black/60 border-white/5 backdrop-blur-xl h-[490px] flex flex-col shadow-2xl">
          <CardHeader className="border-b border-white/5 p-4 shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs font-bold font-mono tracking-widest text-primary">
                EVENTOS DEL SISTEMA
              </CardTitle>
            </div>
            <span className="text-[10px] text-muted-foreground">{logs.length} eventos</span>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar relative">
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_24px] pointer-events-none" />
             <div className="p-4 space-y-4 relative z-10">
               {logs.length === 0 && (
                 <div className="text-xs text-slate-500 italic text-center mt-10">
                   El sistema está en espera...
                 </div>
               )}
               {logs.slice(0, 50).map((log) => (
                 <div key={log.id} className="flex gap-3 text-xs border-b border-white/5 pb-3">
                   <div className="shrink-0 mt-0.5">
                     {log.type === 'success' && <div className="w-4 h-4 rounded-full border border-emerald-500/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /></div>}
                     {log.type === 'error' && <div className="w-4 h-4 rounded-full border border-rose-500/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-rose-400 rounded-full" /></div>}
                     {log.type === 'warning' && <div className="w-4 h-4 rounded-full border border-amber-500/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full" /></div>}
                     {log.type === 'info' && <div className="w-4 h-4 rounded-full border border-slate-500/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full" /></div>}
                   </div>
                   <div className="flex-1 space-y-1">
                     <div className="flex justify-between items-center">
                       <span className={`font-bold font-mono text-[10px] ${
                         log.type === 'success' ? 'text-emerald-400' :
                         log.type === 'error' ? 'text-rose-400' :
                         log.type === 'warning' ? 'text-amber-400' : 'text-slate-400'
                       }`}>
                         {log.source}
                       </span>
                       <span className="text-[9px] text-slate-600 font-mono">
                         {log.timestamp.toLocaleTimeString()}
                       </span>
                     </div>
                     <p className="text-slate-300 font-mono text-[11px] leading-relaxed break-words">{log.message}</p>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
