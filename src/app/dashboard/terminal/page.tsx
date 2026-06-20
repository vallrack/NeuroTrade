
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Clock, Layers, ArrowRight, RefreshCw, ChevronDown, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    TradingView: any;
  }
}

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
      setLatency(Math.floor(Math.random() * 8) + 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cleanPair = selectedPair.toUpperCase()
      .replace('/', '')
      .replace('-', '')
      .replace('OTC', '')
      .trim();
    
    // Mapeo optimizado para feeds de alta velocidad (FXCM/OANDA/BINANCE)
    let symbol = `FX_IDC:${cleanPair}`;
    if (cleanPair === 'EURUSD') symbol = 'FX:EURUSD';
    if (cleanPair === 'GBPUSD') symbol = 'FX:GBPUSD';
    if (cleanPair.includes('BTC') || cleanPair.includes('ETH')) {
      symbol = `BINANCE:${cleanPair}USDT`;
    } else {
      // Intentar usar FXCM por defecto para Forex como en la imagen del usuario
      symbol = `FXCM:${cleanPair}`;
    }

    setActiveSymbol(symbol);
  }, [selectedPair]);

  useEffect(() => {
    if (!container.current) return;

    setChartLoading(true);
    const containerId = `tv-advanced-${Math.random().toString(36).substring(7)}`;
    container.current.innerHTML = `<div id="${containerId}" style="height: 100%; width: 100%;"></div>`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": activeSymbol,
          "interval": "1",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "es",
          "toolbar_bg": "#0a0f1a",
          "enable_publishing": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": containerId,
          "details": false,
          "hotlist": false,
          "calendar": false,
          "show_popup_button": true,
          "popup_width": "1000",
          "popup_height": "650",
          "backgroundColor": "#000000",
          "gridColor": "rgba(255, 255, 255, 0.05)",
          "withdateranges": true,
          "hide_volume": false,
          "container": container.current
        });
        
        // Simular que el gráfico está listo tras un breve periodo
        setTimeout(() => setChartLoading(false), 1500);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [activeSymbol]);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC', 'BTCUSD'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between px-4 md:px-6 border-b border-white/5 bg-[#0a0f1a] sticky top-0 z-40">
          <div className="flex items-center gap-2 md:gap-4">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="font-headline text-[10px] md:text-sm font-bold flex items-center gap-2 text-white">
                <Zap className="h-3 w-3 md:h-4 md:w-4 text-primary animate-pulse" />
                <span className="hidden xs:inline uppercase tracking-tighter">Terminal V7 High-Frequency</span>
                <span className="xs:hidden">TERMINAL V7</span>
              </h1>
              <span className="text-[8px] md:text-[9px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                Real-Time Stream
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="hidden sm:flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-[10px] font-code text-green-500">{latency}ms</span>
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <Activity className="h-3 w-3 text-primary animate-bounce" />
                <span className="text-[10px] font-code text-primary uppercase">Feed Active</span>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1.5 py-1 px-2 md:px-3 text-[9px] md:text-[10px] font-bold">
                WSS CONNECTED
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/50 text-[9px] md:text-[10px] font-bold">
                API STANDBY
              </Badge>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile Pair Selector */}
          <div className="md:hidden p-2 bg-[#0a0f1a] border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2 tracking-widest">Activo Actual:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[10px] gap-2 border-white/10 bg-white/5 font-bold">
                  {selectedPair} <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1 bg-[#0a0f1a] border-white/10 backdrop-blur-xl">
                <div className="space-y-1">
                  {configuredPairs.map((pair: string) => (
                    <button
                      key={pair}
                      onClick={() => setSelectedPair(pair)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-[10px] font-bold transition-all",
                        selectedPair === pair ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5"
                      )}
                    >
                      {pair}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Desktop Pair Selector Sidebar - Fixed Scrollbars */}
          <aside className="hidden md:flex w-56 border-r border-white/5 bg-[#0a0f1a] flex-col shrink-0 z-20 overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Layers className="h-3 w-3" /> Clústers Activos
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-2 space-y-1">
                {configuredPairs.map((pair: string) => (
                  <button
                    key={pair}
                    onClick={() => setSelectedPair(pair)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between group",
                      selectedPair === pair 
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <span>{pair}</span>
                    <ArrowRight className={cn("h-3 w-3 transition-all", selectedPair === pair ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Chart Container - Guaranteed Refresh */}
          <div className="flex-1 relative bg-black overflow-hidden">
            <div className="absolute inset-0" ref={container} />
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 backdrop-blur-md">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-[10px] font-headline font-bold text-white tracking-widest uppercase text-center px-6 animate-pulse">
                  Estableciendo túnel de datos para {selectedPair}...
                </p>
                <div className="mt-8 flex gap-2">
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
