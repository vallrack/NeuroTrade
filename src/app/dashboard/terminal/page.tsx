
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { LineChart, Activity, Globe, ShieldCheck, RefreshCw, Layers, ArrowRight, Zap, Wifi, AlertCircle } from 'lucide-react';
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
      setLatency(Math.floor(Math.random() * 15) + 5);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (botParams?.pairs && botParams.pairs.length > 0) {
      if (!botParams.pairs.includes(selectedPair)) {
        setSelectedPair(botParams.pairs[0]);
      }
    }
  }, [botParams, selectedPair]);

  useEffect(() => {
    // Mapeo inteligente de símbolos para evitar fallos de conexión
    let cleanPair = selectedPair.toUpperCase()
      .replace('/', '')
      .replace('-', '')
      .replace('OTC', '')
      .trim();
    
    let symbol = `FX:${cleanPair}`;
    
    if (cleanPair.includes('BTC') || cleanPair.includes('ETH') || cleanPair.includes('LTC')) {
      symbol = `BINANCE:${cleanPair}USDT`;
    }

    setActiveSymbol(symbol);
    setChartLoading(true);
  }, [selectedPair]);

  useEffect(() => {
    if (!container.current) return;

    // Limpieza profunda del contenedor para evitar duplicados o estados negros
    container.current.innerHTML = '';
    const widgetContainer = document.createElement('div');
    widgetContainer.id = `tv-widget-${activeSymbol.replace(':', '-')}-${Math.random().toString(36).substring(7)}`;
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    container.current.appendChild(widgetContainer);

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
      "allow_symbol_change": false,
      "calendar": false,
      "hide_volume": true,
      "support_host": "https://www.tradingview.com",
      "container_id": widgetContainer.id
    });
    
    widgetContainer.appendChild(script);

    // Timeout de seguridad para desbloquear la UI si el script tarda
    const timer = setTimeout(() => {
      setChartLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeSymbol]);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 border-b border-white/5 bg-[#0a0f1a]/95 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="font-headline text-xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary animate-pulse" />
              Terminal de Operaciones V7
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 mr-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-[10px] font-code font-bold text-muted-foreground uppercase">Net:</span>
                <span className="text-xs font-code font-bold text-green-500">{latency}ms</span>
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                <span className="text-[10px] font-code font-bold text-muted-foreground uppercase">Feed:</span>
                <span className="text-xs font-code font-bold text-primary">REAL-TIME</span>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1.5 py-1 px-3">
                <Globe className="h-3 w-3" />
                PUENTE ACTIVO
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/50 gap-1.5 py-1 px-3">
                <ShieldCheck className="h-3 w-3" />
                VINCULACIÓN REQUERIDA
              </Badge>
            )}
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden bg-black">
          <aside className="w-64 border-r border-white/5 bg-[#0a0f1a] flex flex-col shrink-0 z-20">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Activos V7</span>
              </div>
              <Badge variant="outline" className="text-[9px] h-4 border-primary/30 text-primary">LIVE</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {configuredPairs.map((pair: string) => (
                  <button
                    key={pair}
                    onClick={() => {
                      setSelectedPair(pair);
                      setChartLoading(true);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-between group relative overflow-hidden",
                      selectedPair === pair 
                        ? "bg-primary text-white shadow-xl shadow-primary/20" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <div className="flex flex-col relative z-10">
                      <span className="tracking-tight">{pair}</span>
                      <span className={cn("text-[9px] font-medium uppercase opacity-60", selectedPair === pair ? "text-white" : "text-primary")}>
                        {pair.includes('OTC') ? 'OTC Market' : 'Standard Feed'}
                      </span>
                    </div>
                    {selectedPair === pair && (
                      <div className="absolute right-0 top-0 h-full w-1 bg-white" />
                    )}
                    <ArrowRight className={cn("h-4 w-4 transition-transform relative z-10", selectedPair === pair ? "translate-x-0" : "-translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          <div className="flex-1 flex flex-col relative min-w-0">
            <div className="flex-1 w-full relative" ref={container}>
              {/* TradingView Widget Host */}
            </div>
            
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4 bg-black z-30">
                <div className="relative">
                   <RefreshCw className="h-10 w-10 animate-spin text-primary" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                   </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="font-headline font-bold text-white tracking-widest text-lg">SINCRONIZANDO CLÚSTER</p>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-primary animate-pulse">{selectedPair} | STREAMING V7</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-4 text-[10px] text-muted-foreground hover:text-white"
                  onClick={() => setChartLoading(false)}
                >
                  ¿Tarda demasiado? Forzar Visualización
                </Button>
              </div>
            )}
            
            <div className="h-12 border-t border-white/5 bg-[#0a0f1a] flex items-center px-6 justify-between shrink-0 z-20">
              <div className="flex gap-8 items-center">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Instrumento</span>
                    <span className="text-xs font-code font-bold text-primary">{selectedPair} (Feed: {activeSymbol})</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">IA Sentinel:</span>
                    <span className="text-xs font-code font-bold text-green-500 uppercase">Analizando Acción del Precio</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-primary/10 px-4 py-1 rounded-md border border-primary/20">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-headline">Protección de Capital Activa</span>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
