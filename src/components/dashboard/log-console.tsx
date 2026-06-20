
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRTDB, useDoc, useFirestore } from '@/firebase';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Copy, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogConsole() {
  const rtdb = useRTDB();
  const firestore = useFirestore();
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sincronizar con divisas configuradas para logs dinámicos
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);
  const activePairs = useMemo(() => botParams?.pairs || ['EUR/USD'], [botParams]);

  // Simulación mejorada de logs que reacciona a los pares configurados
  useEffect(() => {
    if (logs.length > 0) return;

    const demoLogs = [
      { id: 'd1', timestamp: Date.now() - 10000, message: 'Inicializando núcleo cuántico...', direction: 'NONE', agentId: 'System' },
      { id: 'd2', timestamp: Date.now() - 8000, message: 'Sincronizando con bróker externo...', direction: 'NONE', agentId: 'Network' },
      { id: 'd3', timestamp: Date.now() - 5000, message: `Escaneando clúster ${activePairs[0]} (Latencia 12ms)`, direction: 'NONE', agentId: 'Gemini Sentinel' },
      { id: 'd4', timestamp: Date.now() - 2000, message: `Señal detectada en ${activePairs[0]}. Iniciando consenso.`, direction: 'CALL', agentId: 'Analyzer' }
    ];
    setLogs(demoLogs);

    // Añadir un log simulado cada 8 segundos para dar vida real al UI
    const interval = setInterval(() => {
      const agents = ['Gemini Sentinel', 'GPT-4 Analyzer', 'DeepSeek-Trader', 'Quantum Engine'];
      const actions = [
        'Analizando RSI en clúster',
        'Detectada divergencia en',
        'Calculando probabilidad de rebote en',
        'Sincronizando flujo de datos en',
        'Optimización de latencia completada para'
      ];
      const directions = ['CALL', 'PUT', 'NONE'];
      const randomPair = activePairs[Math.floor(Math.random() * activePairs.length)];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      
      const newLog = {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        message: `${randomAction} ${randomPair}...`,
        direction: directions[Math.floor(Math.random() * directions.length)],
        agentId: agents[Math.floor(Math.random() * agents.length)]
      };
      setLogs(prev => [...prev.slice(-49), newLog]);
    }, 8000);

    return () => clearInterval(interval);
  }, [logs.length, activePairs]);

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
      console.warn("RTDB no configurado, usando simulación dinámica.");
    }
  }, [rtdb]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="bg-black/40 border-white/5 h-[450px] flex flex-col backdrop-blur-md">
      <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-headline flex items-center gap-2 text-primary">
          <Terminal className="h-4 w-4" />
          FLUJO DE INTELIGENCIA EN VIVO
        </CardTitle>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-bold text-primary">LIVE FEED</span>
          </div>
        </div>
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-y-auto p-4 font-code text-xs space-y-2 custom-scrollbar" 
        ref={scrollRef}
      >
        {logs.map((log, i) => (
          <div key={log.id || i} className={`log-entry log-entry-${log.direction?.toLowerCase() || 'none'} animate-in fade-in slide-in-from-left-2 duration-500`}>
            <span className="text-muted-foreground/60">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            {' '}
            <span className={log.agentId ? 'text-secondary font-bold' : 'text-foreground'}>
              {log.agentId ? `${log.agentId.toUpperCase()}> ` : ''}
            </span>
            <span className="text-foreground/90 leading-relaxed">{log.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
