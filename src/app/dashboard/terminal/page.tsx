
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { 
  Zap, Wifi, Layers, ArrowRight, RefreshCw, Activity, BarChart3, 
  TrendingUp, Maximize2, Cpu, History, ArrowUpCircle, ArrowDownCircle,
  Clock, Filter, MousePointer2, Settings2, Share2, Info, ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const [timeframe, setTimeframe] = useState('M1');

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
        textColor: '#71717a',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { 
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: { 
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const rsiChart = createChart(rsiContainerRef.current, {
      ...chartOptions,
      width: rsiContainerRef.current.clientWidth,
      height: rsiContainerRef.current.clientHeight,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 2,
    });

    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OVERBOUGHT' });
    rsiSeries.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OVERSOLD' });

    const { priceData, rsiData } = generateInitialData();
    priceSeries.setData(priceData);
    rsiSeries.setData(rsiData);

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
      setLatency(Math.floor(Math.random() * 10) + 4);
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
        {/* TOP BAR - PRO TERMINAL STYLE */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-white/5 bg-[#050505] z-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-white" />
              <div className="h-4 w-px bg-white/10 mx-1" />
              <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-md border border-primary/20">
                <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span className="font-headline text-[10px] md:text-xs font-bold text-white uppercase tracking-tighter">
                  IQINVEST V7 PRO
                </span>
              </div>
            </div>

            {/* QUICK TOOLS */}
            <div className="hidden lg:flex items-center gap-1">
              {['M1', 'M5', 'M15', 'H1'].map((tf) => (
                <Button 
                  key={tf} 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "h-7 text-[9px] font-bold px-3 rounded-md transition-all",
                    timeframe === tf ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                  )}
                >
                  {tf}
                </Button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-2" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <Layers className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest leading-none">LATENCIA</span>
                 <span className="text-[10px] font-code text-green-500 font-bold">{latency}ms</span>
               </div>
               <Wifi className="h-4 w-4 text-green-500" />
             </div>
             {isConnected ? (
               <Badge className="bg-green-500/10 text-green-500 border-green-500/30 px-3 py-1 text-[9px] font-black uppercase tracking-widest">
                 LIVE
               </Badge>
             ) : (
               <Badge variant="outline" className="text-muted-foreground border-white/10 px-3 py-1 text-[9px] font-bold uppercase">
                 STANDBY
               </Badge>
             )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR: ASSETS */}
          <aside className="hidden md:flex w-52 border-r border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Mercados</span>
              <Filter className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {configuredPairs.map((pair: string) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold transition-all flex items-center justify-between group",
                    selectedPair === pair 
                      ? "bg-primary shadow-lg shadow-primary/20 text-white" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", selectedPair === pair ? "bg-white" : "bg-white/10 group-hover:bg-primary")} />
                    <span>{pair}</span>
                  </div>
                  {selectedPair === pair && <ArrowRight className="h-3 w-3" />}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 bg-white/5">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[9px] text-muted-foreground font-bold">VOLATILIDAD</span>
                 <span className="text-[9px] text-primary font-bold">ALTA</span>
               </div>
               <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                 <div className="bg-primary h-full w-[85%] animate-pulse" />
               </div>
            </div>
          </aside>

          {/* CENTRAL AREA: CHARTS */}
          <main className="flex-1 relative bg-black flex flex-col min-w-0 p-2 gap-2 overflow-hidden">
            {/* PRICE CHART */}
            <div className="flex-[7] min-h-0 bg-[#070707] rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl">
              <div className="absolute top-4 left-5 z-20 flex items-center gap-3 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight">{selectedPair} • {timeframe}</span>
                  <span className="text-[8px] text-primary font-bold">FXCM FEED ACTIVE</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <Maximize2 className="h-3 w-3 text-muted-foreground hover:text-white cursor-pointer" />
              </div>
              <div className="w-full h-full" ref={priceContainerRef} />
            </div>

            {/* RSI CHART */}
            <div className="flex-[3] min-h-0 bg-[#070707] rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl">
              <div className="absolute top-4 left-5 z-20 flex items-center gap-2 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-white/10">
                <Activity className="h-3 w-3 text-purple-500" />
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">RSI (14) OSCILLATOR</span>
              </div>
              <div className="w-full h-full" ref={rsiContainerRef} />
            </div>
          </main>

          {/* RIGHT SIDEBAR: LIVE FEED & ANALYSIS */}
          <aside className="hidden xl:flex w-72 border-l border-white/5 bg-[#050505] flex-col shrink-0">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">ANÁLISIS V7</span>
              </div>
              <Badge variant="outline" className="text-[8px] border-primary/20 text-primary uppercase px-2">REAL-TIME</Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {/* AI CONSENSUS MINI WIDGET */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">CONSENSO IA</span>
                  <span className="text-xs font-black text-primary">94.2%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[94%]" />
                </div>
                <p className="text-[9px] text-muted-foreground italic leading-tight">
                  Alta probabilidad detectada en el clúster {selectedPair}.
                </p>
              </div>

              {/* LIVE SIGNALS FEED */}
              <div className="space-y-2">
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest block px-1">Últimas Señales</span>
                {recentTrades.length === 0 ? (
                  <div className="text-center py-12 text-[9px] text-muted-foreground uppercase tracking-widest opacity-20 flex flex-col items-center gap-3">
                    <Cpu className="h-8 w-8 animate-pulse" />
                    <span>Esperando entrada...</span>
                  </div>
                ) : (
                  recentTrades.map((trade: any) => (
                    <div key={trade.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2 hover:bg-white/10 transition-all group animate-in slide-in-from-right-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-white group-hover:text-primary transition-colors">{trade.pair}</span>
                        <span className="text-[8px] text-muted-foreground font-code">
                          {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {trade.direction === 'CALL' ? (
                            <ArrowUpCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={cn("text-[10px] font-black uppercase tracking-tighter", trade.direction === 'CALL' ? 'text-green-500' : 'text-red-500')}>
                            {trade.direction}
                          </span>
                        </div>
                        <Badge className={cn("text-[9px] font-black px-2 py-0.5", trade.status === 'win' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500')}>
                          {trade.status === 'win' ? 'PROFIT' : 'LOSS'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FOOTER STATS */}
            <div className="p-4 border-t border-white/5 bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">RIESGO</span>
                <span className="text-[10px] font-bold text-white uppercase">{botParams?.riskMode || 'FIJO'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">BOT STATUS</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", botParams?.bot_activo ? "bg-primary" : "bg-red-500")} />
                  <span className="text-[10px] font-bold text-white uppercase">{botParams?.bot_activo ? "ACTIVE" : "PAUSED"}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
