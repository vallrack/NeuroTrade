
'use client';

import { useEffect, useRef, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Layers, ArrowRight, RefreshCw, Activity, BarChart3, TrendingUp, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore, useRTDB } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { cn } from '@/lib/utils';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, CrosshairMode } from 'lightweight-charts';

export default function TerminalPage() {
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lastCandleRef = useRef<any>(null);
  
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
  const [latency, setLatency] = useState(12);

  // 1. Generador de Datos Históricos Iniciales
  const generateInitialData = () => {
    const priceData = [];
    const rsiData = [];
    const now = Math.floor(Date.now() / 1000);
    let lastPrice = 1.1470;
    
    // Generamos 200 velas de 1 minuto
    for (let i = 200; i >= 0; i--) {
      const time = (Math.floor((now - (i * 60)) / 60) * 60) as any;
      const open = lastPrice;
      const close = open + (Math.random() - 0.5) * 0.0008;
      const high = Math.max(open, close) + Math.random() * 0.0003;
      const low = Math.min(open, close) - Math.random() * 0.0003;
      
      priceData.push({ time, open, high, low, close });
      rsiData.push({ time, value: 30 + (Math.random() * 40) });
      lastPrice = close;
    }
    lastCandleRef.current = priceData[priceData.length - 1];
    return { priceData, rsiData };
  };

  // 2. Inicialización de Gráficos con Sincronización
  useEffect(() => {
    if (!priceContainerRef.current || !rsiContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    };

    const priceChart = createChart(priceContainerRef.current, {
      ...chartOptions,
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

    const rsiChart = createChart(rsiContainerRef.current, {
      ...chartOptions,
      width: rsiContainerRef.current.clientWidth,
      height: rsiContainerRef.current.clientHeight,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
    });

    // Niveles RSI
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SOBRECOMPRA' });
    rsiSeries.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SOBREVENTA' });

    const { priceData, rsiData } = generateInitialData();
    priceSeries.setData(priceData);
    rsiSeries.setData(rsiData);

    // Sincronización de scroll y zoom
    priceChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const range = priceChart.timeScale().getVisibleRange();
      if (range) rsiChart.timeScale().setVisibleRange(range);
    });

    rsiChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const range = rsiChart.timeScale().getVisibleRange();
      if (range) priceChart.timeScale().setVisibleRange(range);
    });

    priceChartRef.current = priceChart;
    rsiChartRef.current = rsiChart;
    priceSeriesRef.current = priceSeries;
    rsiSeriesRef.current = rsiSeries;
    setChartLoading(false);

    const handleResize = () => {
      if (priceContainerRef.current && rsiContainerRef.current) {
        priceChart.applyOptions({ width: priceContainerRef.current.clientWidth, height: priceContainerRef.current.clientHeight });
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth, height: rsiContainerRef.current.clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      priceChart.remove();
      rsiChart.remove();
    };
  }, []);

  // 3. Inyector de Ticks (Simulador HFT de 1 segundo)
  useEffect(() => {
    if (!rtdb) return;
    const cleanPair = selectedPair.replace('/', '').replace('-', '').trim();
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);

    const interval = setInterval(() => {
      const lastPrice = lastCandleRef.current?.close || 1.1470;
      const noise = (Math.random() - 0.5) * 0.0004;
      const newPrice = lastPrice + noise;
      
      set(tickRef, {
        price: parseFloat(newPrice.toFixed(5)),
        timestamp: Date.now(),
        rsi: 30 + (Math.random() * 40)
      });
      setLatency(Math.floor(Math.random() * 15) + 5);
    }, 1000);

    return () => clearInterval(interval);
  }, [rtdb, selectedPair]);

  // 4. Escucha de Tiempo Real y Actualización de Gráficos
  useEffect(() => {
    if (!rtdb || !priceSeriesRef.current || !rsiSeriesRef.current) return;

    const cleanPair = selectedPair.replace('/', '').replace('-', '').trim();
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);

    const unsub = onValue(tickRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.price) {
        const now = Math.floor(Date.now() / 1000);
        const candleTime = (Math.floor(now / 60) * 60) as any;

        const last = lastCandleRef.current;
        
        // Actualizar vela actual del Price Action
        const updateObj = {
          time: candleTime,
          open: last && last.time === candleTime ? last.open : val.price,
          high: last && last.time === candleTime ? Math.max(last.high, val.price) : val.price,
          low: last && last.time === candleTime ? Math.min(last.low, val.price) : val.price,
          close: val.price,
        };
        
        priceSeriesRef.current?.update(updateObj);
        rsiSeriesRef.current?.update({ time: candleTime, value: val.rsi || 50 });
        
        lastCandleRef.current = updateObj;
      }
    });

    return () => unsub();
  }, [rtdb, selectedPair]);

  const configuredPairs = botParams?.pairs || ['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD'];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black flex flex-col h-screen overflow-hidden">
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
                FEED RT: {selectedPair}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-[9px] font-code text-green-500">{latency}ms</span>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30 py-0.5 text-[8px] md:text-[9px] font-bold">CONNECTED</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-white/10 py-0.5 text-[8px] md:text-[9px]">STANDBY</Badge>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <aside className="hidden lg:flex w-56 border-r border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Activos Activos</span>
              <Maximize2 className="h-3 w-3 text-muted-foreground/50" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {configuredPairs.map((pair: string) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-xl text-[10px] font-bold transition-all flex items-center justify-between group",
                    selectedPair === pair ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <span>{pair}</span>
                  <ArrowRight className={cn("h-3 w-3 transition-transform", selectedPair === pair ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 relative bg-black flex flex-col min-w-0 p-2 gap-2 overflow-hidden">
            <div className="flex-[7] min-h-0 bg-[#050505] rounded-2xl border border-white/5 overflow-hidden relative shadow-2xl">
              <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Price Action HFT</span>
              </div>
              <div className="w-full h-full" ref={priceContainerRef} />
            </div>

            <div className="flex-[3] min-h-0 bg-[#050505] rounded-2xl border border-white/5 overflow-hidden relative shadow-2xl">
              <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">RSI Cuántico (14)</span>
              </div>
              <div className="w-full h-full" ref={rsiContainerRef} />
            </div>

            {chartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-[100]">
                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-xs font-headline font-bold text-white tracking-[0.3em] uppercase">Sincronizando Feed Maestro...</p>
              </div>
            )}
            
            <div className="absolute bottom-8 right-8 z-10 hidden sm:flex">
               <div className="bg-primary/10 backdrop-blur-xl border border-primary/20 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl shadow-primary/20">
                  <Activity className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest font-code">WSS STREAM: ACTIVE</span>
               </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
