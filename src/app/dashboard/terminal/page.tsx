'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Layers, ArrowRight, RefreshCw, ChevronDown, Activity, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore, useRTDB } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);
  const isConnected = brokerConfig?.status === 'connected';

  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);

  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [chartLoading, setChartLoading] = useState(true);
  const [latency, setLatency] = useState(8);

  // Generar datos históricos simulados para el arranque inicial
  const generateInitialData = () => {
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    let lastPrice = 1.1470;
    
    for (let i = 200; i >= 0; i--) {
      const open = lastPrice;
      const close = open + (Math.random() - 0.5) * 0.0005;
      const high = Math.max(open, close) + Math.random() * 0.0002;
      const low = Math.min(open, close) - Math.random() * 0.0002;
      
      data.push({
        time: (Math.floor((now - (i * 60)) / 60) * 60) as any,
        open,
        high,
        low,
        close,
      });
      lastPrice = close;
    }
    lastPriceRef.current = lastPrice;
    return data;
  };

  // Inicialización del gráfico Lightweight
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#9B9B9B',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    series.setData(generateInitialData());
    
    chartRef.current = chart;
    seriesRef.current = series;
    setChartLoading(false);

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // ESCUCHA REAL-TIME (Sin recargas de página)
  useEffect(() => {
    if (!rtdb || !seriesRef.current || !selectedPair) return;

    const cleanPair = selectedPair.replace('/', '').replace('-', '').trim();
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);

    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) {
        const now = Math.floor(Date.now() / 1000);
        const candleTime = (Math.floor(now / 60) * 60) as any;

        // Si el precio cambia drásticamente, lo usamos como apertura si es vela nueva
        const currentOpen = lastPriceRef.current || val.price;

        seriesRef.current?.update({
          time: candleTime,
          open: currentOpen,
          high: Math.max(currentOpen, val.price),
          low: Math.min(currentOpen, val.price),
          close: val.price,
        });
        
        lastPriceRef.current = val.price;
      }
    });

    return () => unsub();
  }, [rtdb, selectedPair]);

  // Simulación de latencia variable
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 5) + 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black flex flex-col h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-white/5 bg-[#050505] z-50">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-white transition-colors" />
            <div className="h-4 w-px bg-white/10" />
            <div className="flex flex-col">
              <h1 className="font-headline text-[10px] md:text-xs font-bold flex items-center gap-2 text-white uppercase tracking-tight">
                <Zap className="h-3 w-3 text-primary animate-pulse" />
                Terminal V7 Quantum
              </h1>
              <span className="text-[7px] md:text-[8px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                Live Feed: {selectedPair}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-[9px] font-code text-green-500">{latency}ms</span>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30 py-0.5 text-[8px] md:text-[9px] font-bold uppercase">
                ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-white/10 py-0.5 text-[8px] md:text-[9px] font-bold uppercase">
                STANDBY
              </Badge>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <aside className="hidden lg:flex w-48 border-r border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Clústers</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {configuredPairs.map((pair: string) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between group",
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
          </aside>

          <div className="flex-1 relative bg-black flex flex-col min-w-0">
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
                <PopoverContent className="w-48 p-1 bg-[#050505] border-white/10 shadow-2xl">
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
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 w-full h-full" ref={containerRef} />
            
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-[9px] font-bold text-white tracking-[0.2em] uppercase font-headline">Sincronizando Feed Cuántico...</p>
              </div>
            )}

            <div className="absolute bottom-4 right-4 z-10 hidden sm:flex">
               <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-3 shadow-2xl">
                  <Activity className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest font-code">RT-STREAM: ACTIVE</span>
               </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}