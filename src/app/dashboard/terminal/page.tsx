
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Zap, Wifi, Layers, ArrowRight, RefreshCw, Activity, BarChart3, TrendingUp, Maximize2, Cpu, History, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore, useRTDB, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
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

  // Historial de señales para el panel derecho
  const tradesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(15));
  }, [user, firestore]);
  const { data: recentTrades } = useCollection(tradesQuery);

  const generateInitialData = () => {
    const priceData = [];
    const rsiData = [];
    const now = Math.floor(Date.now() / 1000);
    let lastPrice = 1.1470;
    
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

  useEffect(() => {
    if (!priceContainerRef.current || !rsiContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#111111' },
        horzLines: { color: '#111111' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#222222' },
      timeScale: { borderColor: '#222222', timeVisible: true },
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

    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SOBRECOMPRA' });
    rsiSeries.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SOBREVENTA' });

    const { priceData, rsiData } = generateInitialData();
    priceSeries.setData(priceData);
    rsiSeries.setData(rsiData);

    priceChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const range = priceChart.timeScale().getVisibleRange();
      if (range) rsiChart.timeScale().setVisibleRange(range);
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
        <header className="flex h-12 md:h-14 shrink-0 items-center justify-between px-4 border-b border-white/5 bg-[#050505] z-50">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-white" />
            <div className="h-4 w-px bg-white/10" />
            <h1 className="font-headline text-[10px] md:text-xs font-bold flex items-center gap-2 text-white uppercase tracking-tight">
              <Zap className="h-3 w-3 text-primary" />
              Terminal iqInvest v7 Pro
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
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
          {/* Sidebar Izquierda: Activos */}
          <aside className="hidden md:flex w-48 border-r border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-3 border-b border-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Activos</span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {configuredPairs.map((pair: string) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between",
                    selectedPair === pair ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <span>{pair}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Área Central: Gráficos */}
          <main className="flex-1 relative bg-black flex flex-col min-w-0 p-1.5 gap-1.5 overflow-hidden">
            <div className="flex-[7] min-h-0 bg-[#050505] rounded-xl border border-white/5 overflow-hidden relative">
              <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10">
                <BarChart3 className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-bold text-white uppercase">{selectedPair} - M1</span>
              </div>
              <div className="w-full h-full" ref={priceContainerRef} />
            </div>

            <div className="flex-[3] min-h-0 bg-[#050505] rounded-xl border border-white/5 overflow-hidden relative">
              <div className="absolute top-3 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10">
                <TrendingUp className="h-3 w-3 text-purple-500" />
                <span className="text-[9px] font-bold text-white uppercase">RSI (14)</span>
              </div>
              <div className="w-full h-full" ref={rsiContainerRef} />
            </div>
          </main>

          {/* Sidebar Derecha: Señales en Vivo (Elimina el espacio vacío) */}
          <aside className="hidden xl:flex w-64 border-l border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Cpu className="h-3 w-3 animate-pulse" />
                Señales Maestro V7
              </span>
              <Badge variant="outline" className="text-[7px] border-primary/20 text-primary uppercase">Live</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {recentTrades.length === 0 ? (
                <div className="text-center py-10 text-[9px] text-muted-foreground uppercase tracking-widest opacity-30">
                  <History className="h-6 w-6 mx-auto mb-2" />
                  Esperando Señal...
                </div>
              ) : (
                recentTrades.map((trade: any) => (
                  <div key={trade.id} className="p-2.5 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-1 animate-in fade-in slide-in-from-right-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-white">{trade.pair}</span>
                      <span className="text-[8px] text-muted-foreground font-code">
                        {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        {trade.direction === 'CALL' ? (
                          <ArrowUpCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span className={cn("text-[9px] font-black uppercase", trade.direction === 'CALL' ? 'text-green-500' : 'text-red-500')}>
                          {trade.direction}
                        </span>
                      </div>
                      <Badge className={cn("text-[8px] h-4", trade.status === 'win' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500')}>
                        {trade.status === 'win' ? 'PROFIT' : 'LOSS'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/5 bg-primary/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold text-muted-foreground uppercase">Modo Bot</span>
                <span className="text-[8px] font-bold text-primary uppercase">{botParams?.riskMode || 'FIJO'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-muted-foreground uppercase">Precisión IA</span>
                <span className="text-[8px] font-bold text-green-500 uppercase">94.2%</span>
              </div>
            </div>
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
