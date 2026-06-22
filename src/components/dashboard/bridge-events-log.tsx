'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, WifiOff, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bridgeAnalyze } from '@/lib/bridge';

interface BridgeEvent {
  id: string;
  timestamp: number;
  type: 'success' | 'error' | 'info' | 'warning';
  source: string;
  message: string;
}

function EventIcon({ type }: { type: BridgeEvent['type'] }) {
  switch (type) {
    case 'success': return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />;
    case 'error':   return <AlertCircle  className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />;
    case 'warning': return <AlertCircle  className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />;
    default:        return <Info         className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />;
  }
}

export function BridgeEventsLog() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFetchTime = useRef(0);
  const consecutiveFailures = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  const { data: botParams } = useDoc(botParamsRef);

  const addEvent = (ev: Omit<BridgeEvent, 'id' | 'timestamp'>) =>
    setEvents(prev => [{
      ...ev,
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    }, ...prev].slice(0, 150)); // máximo 150 eventos en memoria

  useEffect(() => {
    if (!mounted || !user || !brokerConfig?.email || !brokerConfig?.password) return;
    let isMounted = true;

    const poll = async () => {
      const now = Date.now();
      if (now - lastFetchTime.current < 9500) return; // cada ~10s
      lastFetchTime.current = now;

      try {
        const pair = botParams?.pairs?.[0] || 'EURUSD-OTC';

        const json = await bridgeAnalyze({
          email: brokerConfig.email,
          password: brokerConfig.password,
          pair,
          accountType: brokerConfig.accountType || 'demo',
        });

        if (!isMounted) return;

        if (json.success) {
          setConnected(true);
          const hadFailures = consecutiveFailures.current > 0;
          consecutiveFailures.current = 0;
          
          if (hadFailures) {
            addEvent({ type: 'success', source: 'RED', message: '✔ Conexión restablecida con el Bridge.' });
          }

          addEvent({
            type: 'success',
            source: 'BRIDGE',
            message: `✔ ${pair} — RSI ${json.rsi?.toFixed(1) ?? '?'} — señal ${json.direction}`,
          });
        }
      } catch (err: any) {
        if (!isMounted) return;
        consecutiveFailures.current++;
        
        if (consecutiveFailures.current >= 3) {
          setConnected(false);
          addEvent({ type: 'error', source: 'RED', message: `✘ Sin conexión estable al Bridge (${consecutiveFailures.current} fallos).` });
        }
      }
    };

    // Evento de inicio
    addEvent({ type: 'info', source: 'V7', message: 'Iniciando monitoreo de eventos...' });

    poll();
    const id = setInterval(poll, 20000); // 20 segundos
    return () => { isMounted = false; clearInterval(id); };
  }, [mounted, user, brokerConfig?.email, brokerConfig?.status, botParams?.pairs]);

  // Auto-scroll al evento más reciente (arriba)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events]);

  if (!mounted) return null;

  return (
    <Card className="bg-black/60 border-white/5 backdrop-blur-md shadow-2xl overflow-hidden">

      {/* Header */}
      <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.02] flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11px] font-mono font-bold flex items-center gap-2 text-indigo-400 tracking-widest uppercase">
          <Activity className="h-3.5 w-3.5" />
          Eventos del Sistema
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 font-mono">{events.length} eventos</span>
          {connected === true  && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-2 py-0 font-mono gap-1"><Wifi className="w-2.5 h-2.5" />ONLINE</Badge>}
          {connected === false && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] px-2 py-0 font-mono gap-1"><WifiOff className="w-2.5 h-2.5" />OFFLINE</Badge>}
          {connected === null  && <Badge className="bg-slate-800 text-slate-500 text-[9px] px-2 py-0 font-mono">SYNC...</Badge>}
        </div>
      </CardHeader>

      {/* Log list */}
      <CardContent className="p-0">
        <div ref={scrollRef} className="h-[280px] overflow-y-auto px-4 py-3 space-y-2 font-mono text-[10px]">
          {events.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-600 text-[10px] font-mono animate-pulse">
              Esperando eventos del Bridge...
            </div>
          )}
          {events.map(ev => (
            <div key={ev.id} className={cn(
              'flex items-start gap-2 py-1 border-b border-white/[0.03] group transition-opacity hover:opacity-100',
              ev.type === 'success' ? 'opacity-90' :
              ev.type === 'error'   ? 'opacity-100' :
              ev.type === 'warning' ? 'opacity-90' : 'opacity-60'
            )}>
              <EventIcon type={ev.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn(
                    'text-[8px] font-bold uppercase tracking-wider px-1 py-0 rounded',
                    ev.type === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                    ev.type === 'error'   ? 'text-red-400 bg-red-500/10' :
                    ev.type === 'warning' ? 'text-yellow-400 bg-yellow-500/10' :
                    'text-slate-500 bg-slate-800/50'
                  )}>{ev.source}</span>
                  <span className="text-[8px] text-slate-600">
                    {new Date(ev.timestamp).toLocaleTimeString('es-CO', { hour12: false })}
                  </span>
                </div>
                <p className={cn(
                  'leading-snug break-words',
                  ev.type === 'success' ? 'text-slate-300' :
                  ev.type === 'error'   ? 'text-red-300' :
                  ev.type === 'warning' ? 'text-yellow-300' :
                  'text-slate-500'
                )}>
                  {ev.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
