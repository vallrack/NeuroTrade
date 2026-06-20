'use client';

import { useState, useEffect, useRef } from 'react';
import { rtdb } from '@/firebase/client';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogConsole() {
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logsRef = query(ref(rtdb, 'logs/bot_reasoning'), limitToLast(50));
    const unsub = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sortedLogs = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp);
        setLogs(sortedLogs);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="bg-black/40 border-white/5 h-[400px] flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-headline flex items-center gap-2 text-primary">
          <Terminal className="h-4 w-4" />
          Intelligence Streaming Console
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7"><Copy className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-y-auto p-4 font-code text-xs space-y-1 custom-scrollbar" 
        ref={scrollRef}
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground animate-pulse">Awaiting incoming data stream...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`log-entry log-entry-${log.direction?.toLowerCase() || 'none'}`}>
              <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              {' '}
              <span className={log.agentId ? 'text-secondary font-bold' : 'text-foreground'}>
                {log.agentId ? `${log.agentId}: ` : ''}
              </span>
              <span className="text-foreground/90">{log.message}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
