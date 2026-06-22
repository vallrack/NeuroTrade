'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRTDB, useDoc, useFirestore, useUser } from '@/firebase';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bridgeAnalyze } from '@/lib/bridge';

export function LogConsole() {
  const rtdb = useRTDB();
  const firestore = useFirestore();
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  const activePairs = useMemo(() => botParams?.pairs || ['EURUSD-OTC'], [botParams]);

  const { user } = useUser();
  const brokerRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef as any);
  const brokerConfigRef = useRef(brokerConfig);

  useEffect(() => {
    brokerConfigRef.current = brokerConfig;
  }, [brokerConfig]);

  useEffect(() => {
    if (!user) return;
    
    let isFetching = false;
    
    const fetchRealLogs = async () => {
      const config = brokerConfigRef.current;
      if (!config || !config.email || !config.password || isFetching) return;
      
      const pair = activePairs[0] || 'EURUSD-OTC';
      isFetching = true;

      try {
        const data = await bridgeAnalyze({
          email: config.email,
          password: config.password,
          pair,
          accountType: config.accountType || 'demo',
        });

        if (data.success && data.logs) {
          setLogs(prev => {
            const combined = [...prev, ...data.logs!.map((l) => {
              let agent = 'SYSTEM';
              if (l.message.includes('[QUANTUM]')) agent = 'QUANTUM-X';
              if (l.message.includes('[SENTINEL]')) agent = 'CYBER-SENTINEL';
              if (l.message.includes('[IA MAIN]')) agent = 'V7-MAESTRO';

              let direction = 'NONE';
              if (l.message.includes('CALL')) direction = 'CALL';
              if (l.message.includes('PUT')) direction = 'PUT';

              return {
                id: Math.random().toString(36),
                timestamp: l.timestamp * 1000,
                message: l.message.replace(/\[.*?\]\s*/, ''),
                direction,
                agentId: agent,
              };
            })];
            return combined.slice(-100);
          });
        }
      } catch (err) {
        // Silencioso en la consola para no spoilar la estética
      } finally {
        isFetching = false;
      }
    };

    fetchRealLogs(); // Inicial
    const interval = setInterval(fetchRealLogs, 15000); // 15 segundos

    return () => clearInterval(interval);
  }, [user, activePairs]);

  // Integración con Realtime Database si está disponible
  useEffect(() => {
    if (!rtdb) return;
    try {
      const logsRef = query(ref(rtdb, 'logs/bot_reasoning'), limitToLast(50));
      const unsub = onValue(logsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const logsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          const sortedLogs = logsArray.sort((a: any, b: any) => a.timestamp - b.timestamp);
          setLogs(sortedLogs);
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('RTDB Logs offline, usando simulador local.');
    }
  }, [rtdb]);

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
        {logs.map((log, i) => (
          <div key={log.id || i} className={cn(
            "log-entry transition-all duration-300 animate-in fade-in slide-in-from-left-1",
            log.direction === 'CALL' ? 'log-entry-call' : log.direction === 'PUT' ? 'log-entry-put' : 'log-entry-none'
          )}>
            <span className="text-muted-foreground/40 font-mono">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
            {' '}
            <span className={cn("font-bold tracking-tighter", log.agentId ? 'text-primary' : 'text-foreground')}>
              {log.agentId ? `${log.agentId.toUpperCase()}> ` : ''}
            </span>
            <span className="text-foreground/80 font-mono tracking-tight">{log.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
