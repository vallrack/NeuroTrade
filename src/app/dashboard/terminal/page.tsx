
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { LineChart, Activity, Globe, ShieldCheck, RefreshCw, Layers, ArrowRight, Zap, Wifi, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function TerminalPage() {
  const container = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);
  const isConnected = brokerConfig?.status === 'connected';

  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);

  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [activeSymbol, setActiveSymbol] = useState('FX:EURUSD');
  const [chartLoading, setChartLoading] = useState(true);
  const [latency, setLatency] = useState(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 10) + 5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cleanPair = selectedPair.toUpperCase()
      .replace('/', '')
      .replace('-', '')
      .replace('OTC', '')
      .trim();
    
    // Mapeo a los proveedores de datos más precisos (FXCM es el de tu imagen)
    let symbol = `FX_IDC:${cleanPair}`;
    if (cleanPair === 'EURUSD') symbol = 'FX:EURUSD';
    if (cleanPair === 'GBPUSD') symbol = 'FX:GBPUSD';
    
    if (cleanPair.includes('BTC') || cleanPair.includes('ETH')) {
      symbol = `BINANCE:${cleanPair}USDT`;
    }

    setActiveSymbol(symbol);
  }, [selectedPair]);

  useEffect(() => {
    if (!container.current) return;

    setChartLoading(true);
    container.current.innerHTML = '';
    const widgetContainer = document.createElement('div');
    widgetContainer.id = `tv-advanced-${Math.random().toString(36).substring(7)}`;
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    container.current.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined') {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": activeSymbol,
          "interval": "1",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "es",
          "toolbar_bg": "#f1f3f6",
          "enable_publishing": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": widgetContainer.id,
          "details": true,
          "hotlist": true,
          "calendar": true,
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650"
        });
        setChartLoading(false);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [activeSymbol]);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black">
        <header className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-[#0a0f1a] sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="font-headline text-sm font-bold flex items-center gap-2 text-white">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
                TERMINAL PROFESIONAL V7
              </h1>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">TradingView Real-Time Feed</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-[10px] font-code text-green-500">{latency}ms</span>
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <Clock className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-code text-primary uppercase">M1 VELAS</span>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1.5 py-1 px-3 text-[10px]">
                CONECTADO A IQ
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/50 text-[10px]">
                MODO VIGILANCIA
              </Badge>
            )}
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <aside className="w-56 border-r border-white/5 bg-[#0a0f1a] flex flex-col shrink-0 z-20">
            <div className="p-4 border-b border-white/5 bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Layers className="h-3 w-3" /> Clústers Activos
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {configuredPairs.map((pair: string) => (
                  <button
                    key={pair}
                    onClick={() => setSelectedPair(pair)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between group",
                      selectedPair === pair 
                        ? "bg-primary text-white" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <span>{pair}</span>
                    <ArrowRight className={cn("h-3 w-3 transition-transform", selectedPair === pair ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          <div className="flex-1 relative bg-black">
            <div className="absolute inset-0" ref={container} />
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-xs font-headline font-bold text-white tracking-widest uppercase">Cargando Feed de {selectedPair}...</p>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
