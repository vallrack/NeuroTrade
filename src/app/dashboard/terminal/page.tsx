'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Layers, ArrowRight, RefreshCw, ChevronDown, Activity, Search, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore, useRTDB } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';

export default function TerminalPage() {
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  
  const priceChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
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

  // Generar datos históricos simulados para el arranque inicial (Sincronizados)
  const generateInitialData = () => {
    const priceData = [];
    const rsiData = [];
    const now = Math.floor(Date.now() / 1000);
    let lastPrice = 1.1470;
    
    for (let i = 300; i >= 0; i--) {
      const time = (Math.floor((now - (i * 60)) / 60) * 60) as any;
      const open = lastPrice;
      const close = open + (Math.random() - 0.5) * 0.0006;
      const high = Math.max(open, close) + Math.random() * 0.0002;
      const low = Math.min(open, close) - Math.random() * 0.0002;
      
      priceData.push({ time, open, high, low, close });
      
      // Simular RSI basado en la posición relativa
      const rsiValue = 40 + (Math.random() * 20);
      rsiData.push({ time, value: rsiValue });
      
      lastPrice = close;
    }
    lastPriceRef.current = lastPrice;
    return { priceData, rsiData };
  };

  // Inicialización de Gráficos Duales
  useEffect(() => {
    if (!priceContainerRef.current || !rsiContainerRef.current) return;

    const commonOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#9B9B9B',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      timeScale: {
        visible: false, // Oculto por defecto, se activa en el de abajo
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      handleScroll: true,
      handleScale: true,
    };

    // 1. Gráfico de Precio
    const priceChart = createChart(priceContainerRef.current, {
      ...commonOptions,
      width: priceContainerRef.current.clientWidth,
      height: priceContainerRef.current.clientHeight,
    });

    const priceSeries = priceChart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // 2. Gráfico de RSI
    const rsiChart = createChart(rsiContainerRef.current, {
      ...commonOptions,
      width: rsiContainerRef.current.clientWidth,
      height: rsiContainerRef.current.clientHeight,
      timeScale: {
        ...commonOptions.timeScale,
        visible: true, // El gráfico de abajo muestra el tiempo
        secondsVisible: true,
      },
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
    });

    // Líneas de Niveles RSI (Igual que en Python: 30/70)
    rsiSeries.createPriceLine({
        price: 70,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'OVERBOUGHT',
    });
    rsiSeries.createPriceLine({
        price: 30,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'OVERSOLD',
    });

    const { priceData, rsiData } = generateInitialData();
    priceSeries.setData(priceData);
    rsiSeries.setData(rsiData);
    
    // 3. SINCRONIZACIÓN MAESTRA
    const syncTimeScales = (sourceChart: IChartApi, targetChart: IChartApi) => {
      sourceChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        const range = sourceChart.timeScale().getVisibleRange();
        if (range) {
          targetChart.timeScale().setVisibleRange(range);
        }
      });
    };

    syncTimeScales(priceChart, rsiChart);
    syncTimeScales(rsiChart, priceChart);

    priceChartRef.current = priceChart;
    rsiChartRef.current = rsiChart;
    priceSeriesRef.current = priceSeries;
    rsiSeriesRef.current = rsiSeries;
    setChartLoading(false);

    const handleResize = () => {
      if (priceContainerRef.current && rsiContainerRef.current && priceChartRef.current && rsiChartRef.current) {
        priceChartRef.current.applyOptions({
          width: priceContainerRef.current.clientWidth,
          height: priceContainerRef.current.clientHeight,
        });
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
          height: rsiContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      priceChart.remove();
      rsiChart.remove();
    };
  }, []);

  // ESCUCHA REAL-TIME (Sincronizada para ambos gráficos)
  useEffect(() => {
    if (!rtdb || !priceSeriesRef.current || !rsiSeriesRef.current || !selectedPair) return;

    const cleanPair = selectedPair.replace('/', '').replace('-', '').trim();
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);

    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) {
        const now = Math.floor(Date.now() / 1000);
        const candleTime = (Math.floor(now / 60) * 60) as any;

        const currentOpen = lastPriceRef.current || val.price;

        // Actualizar Precio
        priceSeriesRef.current?.update({
          time: candleTime,
          open: currentOpen,
          high: Math.max(currentOpen, val.price),
          low: Math.min(currentOpen, val.price),
          close: val.price,
        });

        // Actualizar RSI (Cálculo simulado basado en el tick real)
        const rsiVal = val.rsi || 40 + (Math.sin(now / 10) * 20);
        rsiSeriesRef.current?.update({
          time: candleTime,
          value: rsiVal,
        });
        
        lastPriceRef.current = val.price;
      }
    });

    return () => unsub();
  }, [rtdb, selectedPair]);

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
                Terminal iqInvest v7 Pro
              </h1>
              <span className="text-[7px] md:text-[8px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                Live Multichart: {selectedPair}
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
                CONNECTED
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
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Clusters</span>
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
            {/* Contenedor de Gráficos Duales */}
            <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
              {/* Gráfico de Precio (70% altura) */}
              <div className="flex-[7] min-h-0 bg-black rounded-xl border border-white/5 overflow-hidden relative">
                <div className="absolute top-2 left-4 z-20 flex items-center gap-2 bg-black/50 backdrop-blur-md p-1 px-2 rounded-md border border-white/10 pointer-events-none">
                  <BarChart3 className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-bold text-white/70 uppercase">Price Action</span>
                </div>
                <div className="w-full h-full" ref={priceContainerRef} />
              </div>

              {/* Gráfico de RSI (30% altura) */}
              <div className="flex-[3] min-h-0 bg-black rounded-xl border border-white/5 overflow-hidden relative">
                <div className="absolute top-2 left-4 z-20 flex items-center gap-2 bg-black/50 backdrop-blur-md p-1 px-2 rounded-md border border-white/10 pointer-events-none">
                  <TrendingUp className="h-3 w-3 text-purple-500" />
                  <span className="text-[9px] font-bold text-white/70 uppercase">Quantum RSI (14)</span>
                </div>
                <div className="w-full h-full" ref={rsiContainerRef} />
              </div>
            </div>
            
            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[100]">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-[9px] font-bold text-white tracking-[0.2em] uppercase font-headline">Syncing Multi-Chart Feed...</p>
              </div>
            )}

            <div className="absolute bottom-6 right-6 z-10 hidden sm:flex">
               <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-3 shadow-2xl">
                  <Activity className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest font-code">DUAL-STREAM: SYNCED</span>
               </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
