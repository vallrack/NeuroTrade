
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Layers, ArrowRight, RefreshCw, ChevronDown, Activity, Maximize2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
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
  const [latency, setLatency] = useState(8);

  // Efecto para simular latencia de red HFT
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 5) + 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Limpieza y mapeo de símbolos para evitar el error "Símbolo no existe"
  useEffect(() => {
    let cleanPair = selectedPair.toUpperCase()
      .replace('/', '')
      .replace('-', '')
      .replace('OTC', '')
      .trim();
    
    // Mapeo Maestro de Símbolos compatibles con la widget gratuita de TradingView
    let symbol = `FX:EURUSD`; // Fallback seguro
    
    if (cleanPair === 'EURUSD') symbol = 'FX:EURUSD';
    else if (cleanPair === 'GBPUSD') symbol = 'FX:GBPUSD';
    else if (cleanPair === 'USDJPY') symbol = 'FX:USDJPY';
    else if (cleanPair === 'AUDUSD') symbol = 'FX:AUDUSD';
    else if (cleanPair.includes('BTC')) symbol = 'BINANCE:BTCUSDT';
    else if (cleanPair.includes('ETH')) symbol = 'BINANCE:ETHUSDT';
    else if (cleanPair.includes('SOL')) symbol = 'BINANCE:SOLUSDT';
    else {
      // Si es otro par Forex, intentamos con prefijo FX: o OANDA:
      symbol = `FX:${cleanPair}`;
    }

    setActiveSymbol(symbol);
  }, [selectedPair]);

  // Inicialización del Widget de TradingView
  useEffect(() => {
    if (!container.current) return;

    setChartLoading(true);
    const containerId = `tv_chart_${Math.random().toString(36).substring(7)}`;
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
          "toolbar_bg": "#050505",
          "enable_publishing": false,
          "hide_side_toolbar": false,
          "allow_symbol_change": true,
          "container_id": containerId,
          "backgroundColor": "#000000",
          "gridColor": "rgba(42, 46, 57, 0.05)",
          "withdateranges": true,
          "hide_volume": false,
          "studies": [
            "RSI@tv-basicstudies",
            "StochasticRSI@tv-basicstudies"
          ],
        });
        
        setTimeout(() => setChartLoading(false), 1200);
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [activeSymbol]);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black flex flex-col h-screen overflow-hidden border-l border-white/5">
        {/* Sub-Header del Terminal */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-white/5 bg-[#050505] z-50">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-white transition-colors" />
            <div className="h-4 w-px bg-white/10" />
            <div className="flex flex-col">
              <h1 className="font-headline text-[10px] md:text-xs font-bold flex items-center gap-2 text-white uppercase tracking-tight">
                <Zap className="h-3 w-3 text-primary animate-pulse" />
                Terminal V7 Quantum
              </h1>
              <span className="text-[7px] md:text-[8px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                Consenso Activo: {activeSymbol}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-[9px] font-code text-green-500">{latency}ms</span>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30 py-0.5 text-[8px] md:text-[9px] font-bold uppercase tracking-tighter">
                BRIDGE LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-white/10 py-0.5 text-[8px] md:text-[9px] font-bold">
                STANDBY
              </Badge>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Listado de Clústers Lateral - Diseño Fijo para evitar overlap */}
          <aside className="hidden lg:flex w-48 border-r border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Clústers HFT</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-black/40">
              {configuredPairs.map((pair: string) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between group",
                    selectedPair === pair 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <span>{pair}</span>
                  <ArrowRight className={cn("h-3 w-3 transition-transform", selectedPair === pair ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                </button>
              ))}
            </div>
          </aside>

          {/* Área Principal del Gráfico */}
          <div className="flex-1 relative bg-black flex flex-col min-w-0">
            {/* Control Flotante para Móviles */}
            <div className="lg:hidden flex items-center justify-between p-2 bg-[#080808] border-b border-white/5">
               <div className="flex items-center gap-2">
                 <Search className="h-3 w-3 text-muted-foreground" />
                 <span className="text-[9px] font-bold text-muted-foreground uppercase">Activo:</span>
               </div>
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-2 border border-white/10 bg-white/5 font-bold">
                    {selectedPair} <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1 bg-[#050505] border-white/10 backdrop-blur-3xl shadow-2xl">
                  <div className="space-y-0.5">
                    {configuredPairs.map((pair: string) => (
                      <button
                        key={pair}
                        onClick={() => setSelectedPair(pair)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-md text-[10px] font-bold transition-all",
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

            {/* Contenedor del Widget */}
            <div className="flex-1" ref={container} id="tradingview_container" />
            
            {/* Capa de Carga */}
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-[10px] font-bold text-white tracking-[0.3em] uppercase animate-pulse">
                  Estableciendo Túnel V7: {selectedPair}...
                </p>
                <p className="text-[8px] text-muted-foreground mt-2 font-code">Sincronizando feed de {activeSymbol}</p>
              </div>
            )}

            {/* Leyenda de Estado */}
            <div className="absolute bottom-4 right-4 z-10 hidden sm:flex">
               <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-3 shadow-2xl">
                  <Activity className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Feed Sincronizado V7</span>
               </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
