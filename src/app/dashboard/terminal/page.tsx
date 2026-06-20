
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { LineChart, Activity, Globe, ShieldCheck, RefreshCw, Layers, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

  // Sincronizar par seleccionado con los configurados
  useEffect(() => {
    if (botParams?.pairs && botParams.pairs.length > 0) {
      if (!botParams.pairs.includes(selectedPair)) {
        setSelectedPair(botParams.pairs[0]);
      }
    }
  }, [botParams, selectedPair]);

  // Convertir par a formato TradingView
  useEffect(() => {
    const cleanPair = selectedPair.replace('/', '');
    let symbol = `FX:${cleanPair}`;
    if (selectedPair.includes('BTC') || selectedPair.includes('ETH')) {
      symbol = `BINANCE:${cleanPair}T`;
    }
    setActiveSymbol(symbol);
    setChartLoading(true);
  }, [selectedPair]);

  // Inyectar Widget de TradingView
  useEffect(() => {
    if (!container.current) return;

    // Limpiar contenedor anterior
    container.current.innerHTML = '';
    const widgetContainer = document.createElement('div');
    widgetContainer.id = `tv-widget-${activeSymbol}`;
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

    // Pequeño delay para quitar el estado de carga
    const timer = setTimeout(() => setChartLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [activeSymbol]);

  const configuredPairs = botParams?.pairs || ['EUR/USD'];

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
                PUENTE {brokerConfig?.accountType?.toUpperCase()} ACTIVO
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/50 gap-1.5 py-1 px-3">
                <ShieldCheck className="h-3 w-3" />
                VINCULACIÓN REQUERIDA
              </Badge>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Live Feed</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden bg-black">
          {/* Selector Lateral de Activos */}
          <aside className="w-48 border-r border-white/5 bg-card/30 backdrop-blur-sm flex flex-col shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Activos</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {configuredPairs.map((pair: string) => (
                  <button
                    key={pair}
                    onClick={() => setSelectedPair(pair)}
                    className={cn(
                      "w-full text-left px-3 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between group",
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
            </ScrollArea>
          </aside>

          {/* Área de Gráfico */}
          <div className="flex-1 flex flex-col relative min-w-0">
            <div className="flex-1 w-full relative" ref={container}>
              {/* Este div será el host del widget */}
            </div>
            
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4 bg-black z-20">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="animate-pulse font-headline">Sincronizando flujo de {selectedPair}...</p>
              </div>
            )}
            
            <div className="h-10 border-t border-white/5 bg-card/80 backdrop-blur-md flex items-center px-6 justify-between shrink-0">
              <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Activo:</span>
                  <span className="text-xs font-code font-bold text-foreground">{selectedPair}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Latencia:</span>
                  <span className="text-xs font-code font-bold text-green-500">12ms</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">IA Escaneando mercado...</span>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
