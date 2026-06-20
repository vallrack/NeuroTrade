
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { LineChart, Activity, Globe, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function TerminalPage() {
  const container = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);
  const isConnected = brokerConfig?.status === 'connected';

  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);

  const [activeSymbol, setActiveSymbol] = useState('FX:EURUSD');

  useEffect(() => {
    if (botParams?.pairs?.[0]) {
      const pair = botParams.pairs[0].replace('/', '');
      setActiveSymbol(`FX:${pair}`);
    }
  }, [botParams]);

  useEffect(() => {
    if (!container.current) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": activeSymbol,
      "interval": "1",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "es",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "allow_symbol_change": true,
      "save_image": false,
      "calendar": false,
      "hide_volume": true,
      "support_host": "https://www.tradingview.com"
    });
    
    container.current.innerHTML = '';
    container.current.appendChild(script);
  }, [activeSymbol]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="font-headline text-xl font-bold flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Terminal de Operaciones
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1.5 py-1 px-3">
                <Globe className="h-3 w-3" />
                PUENTE IQ OPTION ACTIVO
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/50 gap-1.5 py-1 px-3">
                <ShieldCheck className="h-3 w-3" />
                VINCULACIÓN REQUERIDA
              </Badge>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Live Feed</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden bg-black">
          <div className="flex-1 w-full relative" ref={container}>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="animate-pulse font-headline">Sincronizando flujo de {activeSymbol}...</p>
            </div>
          </div>
          
          <div className="h-12 border-t border-white/5 bg-card/80 backdrop-blur-md flex items-center px-6 justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Activo Principal</span>
                <span className="text-xs font-code font-bold text-foreground">{botParams?.pairs?.[0] || 'EUR/USD'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Latencia</span>
                <span className="text-xs font-code font-bold text-green-500">12ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Servidor</span>
                <span className="text-xs font-code font-bold text-primary">Quantum-NY-04</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">IA Monitoreando {botParams?.pairs?.length || 0} clústeres...</span>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
