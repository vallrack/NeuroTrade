
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal as TerminalIcon, 
  Activity, 
  Zap, 
  Database, 
  Shield, 
  Clock, 
  Loader2,
  Lock,
  Unlock,
  Cpu
} from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { bridgeAnalyze, getBridgeUrl, getBridgeModeLabel } from '@/lib/bridge';

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const { user } = useUser();
  const firestore = useFirestore();

  // Obtener credenciales para IQ Option
  const brokerRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef as any);

  const brokerConfigRef = useRef(brokerConfig);
  useEffect(() => {
    brokerConfigRef.current = brokerConfig;
  }, [brokerConfig]);

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    
    let isFetching = false;
    let lastLogFetch = 0;

    const fetchRealLogs = async () => {
      const config = brokerConfigRef.current;
      if (!config || !config.email || !config.password || isFetching) return;
      
      const now = Date.now();
      if (now - lastLogFetch < 10000) return; // Máximo cada 10 segundos
      lastLogFetch = now;

      isFetching = true;
      try {
        const data = await bridgeAnalyze({
          email: config.email,
          password: config.password,
          pair: 'EURUSD-OTC',
          accountType: config.accountType || 'demo',
        });

        if (data.success) {
          setLogs(prev => {
            const newLog = {
              id: Math.random().toString(36),
              timestamp: new Date(),
              message: `Telemetría [${data.pair}] RSI:${data.rsi?.toFixed(1)} ${data.direction} — Balance: $${data.balance} — ${getBridgeModeLabel()}`,
              level: 'success',
            };
            return [...prev, newLog].slice(-50);
          });
        }
      } catch (err) {
        // Silencioso o un solo log de error
      } finally {
        isFetching = false;
      }
    };

    fetchRealLogs();
    const interval = setInterval(fetchRealLogs, 15000); 

    return () => {
      clearInterval(interval);
    };
  }, [user]);


  useEffect(() => {
     if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
  }, [logs]);

  const loading = false;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
             <SidebarTrigger />
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <TerminalIcon className="h-4 w-4 text-primary" />
               </div>
               <h1 className="font-headline text-lg font-bold tracking-tight">Terminal HFT V7</h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                SISTEMA OPERATIVO
             </Badge>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto w-full h-[calc(100vh-64px)] flex flex-col">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 shrink-0">
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                       <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ejecución</p>
                       <p className="text-xl font-code font-bold">24ms</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-secondary/10 rounded-xl">
                       <Database className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Stream</p>
                       <p className="text-xl font-code font-bold">ACTIVO</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-yellow-500/10 rounded-xl">
                       <Shield className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Protección</p>
                       <p className="text-xl font-code font-bold">AES-256</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                       <Activity className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">IA Load</p>
                       <p className="text-xl font-code font-bold">14.8%</p>
                    </div>
                 </CardContent>
              </Card>
           </div>

           <Card className="flex-1 bg-zinc-950 border-white/10 overflow-hidden flex flex-col shadow-2xl relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(38,166,154,0.05),transparent)] pointer-events-none" />
              <CardHeader className="border-b border-white/10 bg-zinc-900/50 px-6 py-4 flex flex-row items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                       <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                       <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                       <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40" />
                    </div>
                    <Separator orientation="vertical" className="h-4 bg-white/10" />
                    <div className="flex items-center gap-2 text-xs font-code text-muted-foreground">
                       <Lock className="h-3 w-3" />
                       <span>root@neurotrade-v7:~# tail -f /logs/hft.log</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <Badge variant="outline" className="font-code text-[10px] border-white/10">
                       {logs?.length || 0} LINES CACHED
                    </Badge>
                 </div>
              </CardHeader>
              
              <CardContent 
                 ref={scrollRef}
                 className="flex-1 overflow-y-auto p-6 font-code text-xs md:text-sm custom-scrollbar bg-black/40"
              >
                 {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                       <Loader2 className="h-8 w-8 animate-spin text-primary" />
                       <p className="font-headline tracking-widest uppercase font-bold text-[10px]">Conectando a Bridge Python Real...</p>
                    </div>
                 ) : (
                    <div className="space-y-1.5">
                       {logs?.map((log: any, idx: number) => {
                          const dateObj = log.timestamp instanceof Date ? log.timestamp : (log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || Date.now()));
                          return (
                          <div key={log.id} className="group flex gap-4 hover:bg-white/5 p-1 rounded transition-colors border-l-2 border-transparent hover:border-primary/50">
                             <span className="text-muted-foreground/30 shrink-0 w-10 text-right select-none">{logs.length - idx}</span>
                             <span className="text-primary/60 shrink-0 select-none">[{dateObj.toLocaleTimeString()}]</span>
                             <span className={cn(
                                "break-all",
                                log.level === 'error' ? 'text-red-400' :
                                log.level === 'warning' ? 'text-yellow-400' :
                                log.level === 'success' ? 'text-green-400' : 'text-zinc-300'
                             )}>
                                <span className="opacity-50 mr-2">»</span>
                                {log.message}
                             </span>
                          </div>
                          );
                       })}
                       {logs.length === 0 && (
                          <div className="text-muted-foreground">Recepción de telemetría iniciada. Esperando datos del mercado de IQ Option...</div>
                       )}
                       <div className="flex gap-4 p-1 animate-pulse">
                          <span className="text-muted-foreground/30 shrink-0 w-10 text-right select-none">{logs?.length + 1}</span>
                          <span className="text-primary font-bold">_</span>
                       </div>
                    </div>
                 )}
              </CardContent>
           </Card>

           <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <Cpu className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Kernell: v7.0.2-Stable</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Permission: Super-Admin</span>
                 </div>
              </div>
              <div className="text-[10px] font-bold text-muted-foreground/50 italic uppercase tracking-tighter">
                 High Frequency Trading Neural Center • Restricted Access L-5
              </div>
           </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
