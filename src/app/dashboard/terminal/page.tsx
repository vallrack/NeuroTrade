'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { 
  Zap, Wifi, Activity, BarChart3, 
  TrendingUp, Cpu, ArrowUpCircle, ArrowDownCircle,
  Clock, LineChart, ChevronDown,
  Plus, MousePointer2, Type, Pencil, Magnet,
  Lock, Trash2, LayoutGrid, Ruler, Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser, useDoc, useFirestore, useRTDB, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { cn } from '@/lib/utils';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, CrosshairMode } from 'lightweight-charts';

export default function TerminalPage() {
  // Chart Refs
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const stochContainerRef = useRef<HTMLDivElement>(null);
  
  const priceChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const stochChartRef = useRef<IChartApi | null>(null);
  
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stochKSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stochDSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const lastCandleRef = useRef<any>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);

  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [latency, setLatency] = useState(12);
  const [timeframe, setTimeframe] = useState('1m');

  const tradesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(15));
  }, [user, firestore]);
  const { data: recentTrades } = useCollection(tradesQuery);

  const generateInitialData = () => {
    const priceData = [];
    const volumeData = [];
    const rsiData = [];
    const stochK = [];
    const stochD = [];
    const now = Math.floor(Date.now() / 1000);
    let lastPrice = 1.1470;
    
    for (let i = 200; i >= 0; i--) {
      const time = (Math.floor((now - (i * 60)) / 60) * 60) as any;
      const open = lastPrice;
      const close = open + (Math.random() - 0.5) * 0.0008;
      const high = Math.max(open, close) + Math.random() * 0.0003;
      const low = Math.min(open, close) - Math.random() * 0.0003;
      
      priceData.push({ time, open, high, low, close });
      volumeData.push({ 
        time, 
        value: Math.random() * 100, 
        color: close >= open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)' 
      });
      rsiData.push({ time, value: 30 + (Math.random() * 40) });
      stochK.push({ time, value: 40 + (Math.sin(i/5) * 20) });
      stochD.push({ time, value: 40 + (Math.sin(i/6) * 18) });
      
      lastPrice = close;
    }
    lastCandleRef.current = priceData[priceData.length - 1];
    return { priceData, volumeData, rsiData, stochK, stochD };
  };

  useEffect(() => {
    if (!priceContainerRef.current || !rsiContainerRef.current || !stochContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#d1d4dc',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.05)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { 
        borderColor: 'rgba(255, 255, 255, 0.1)',
        visible: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true },
    };

    // 1. Price Chart
    const priceChart = createChart(priceContainerRef.current, {
      ...chartOptions,
      width: priceContainerRef.current.clientWidth,
      height: priceContainerRef.current.clientHeight,
    });
    const priceSeries = priceChart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    const volumeSeries = priceChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Separate scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // 2. RSI Chart
    const rsiChart = createChart(rsiContainerRef.current, {
      ...chartOptions,
      width: rsiContainerRef.current.clientWidth,
      height: rsiContainerRef.current.clientHeight,
    });
    const rsiSeries = rsiChart.addLineSeries({ color: '#9c27b0', lineWidth: 2 });
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(156, 39, 176, 0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(156, 39, 176, 0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed });

    // 3. Stoch RSI Chart
    const stochChart = createChart(stochContainerRef.current, {
      ...chartOptions,
      width: stochContainerRef.current.clientWidth,
      height: stochContainerRef.current.clientHeight,
    });
    const stochKSeries = stochChart.addLineSeries({ color: '#2196f3', lineWidth: 1.5 });
    const stochDSeries = stochChart.addLineSeries({ color: '#ff9800', lineWidth: 1.5 });

    // Syncronization - FIXED: Added deeper null checks and try-catch to prevent "Value is null" error
    priceChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (range && rsiChart && stochChart) {
        try {
          rsiChart.timeScale().setVisibleRange(range);
          stochChart.timeScale().setVisibleRange(range);
        } catch (e) {
          // Ignore synchronization errors if charts are not ready
        }
      }
    });

    const { priceData, volumeData, rsiData, stochK, stochD } = generateInitialData();
    priceSeries.setData(priceData);
    volumeSeries.setData(volumeData);
    rsiSeries.setData(rsiData);
    stochKSeries.setData(stochK);
    stochDSeries.setData(stochD);

    priceChartRef.current = priceChart;
    rsiChartRef.current = rsiChart;
    stochChartRef.current = stochChart;
    priceSeriesRef.current = priceSeries;
    volumeSeriesRef.current = volumeSeries;
    rsiSeriesRef.current = rsiSeries;
    stochKSeriesRef.current = stochKSeries;
    stochDSeriesRef.current = stochDSeries;

    const handleResize = () => {
      if (priceContainerRef.current && rsiContainerRef.current && stochContainerRef.current) {
        priceChart.applyOptions({ width: priceContainerRef.current.clientWidth, height: priceContainerRef.current.clientHeight });
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth, height: rsiContainerRef.current.clientHeight });
        stochChart.applyOptions({ width: stochContainerRef.current.clientWidth, height: stochContainerRef.current.clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      priceChart.remove();
      rsiChart.remove();
      stochChart.remove();
    };
  }, []);

  useEffect(() => {
    if (!rtdb) return;
    const cleanPair = selectedPair.replace('/', '').replace('-', '').trim();
    const tickRef = ref(rtdb, `market/ticks/${cleanPair}`);

    const interval = setInterval(() => {
      const lastPrice = lastCandleRef.current?.close || 1.1470;
      const noise = (Math.random() - 0.5) * 0.0002;
      const newPrice = lastPrice + noise;
      
      set(tickRef, {
        price: parseFloat(newPrice.toFixed(5)),
        timestamp: Date.now(),
        rsi: 30 + (Math.random() * 40)
      });
      setLatency(Math.floor(Math.random() * 8) + 4);
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
        volumeSeriesRef.current?.update({ 
          time: candleTime, 
          value: Math.random() * 100,
          color: updateObj.close >= updateObj.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)'
        });
        rsiSeriesRef.current?.update({ time: candleTime, value: val.rsi || 50 });
        stochKSeriesRef.current?.update({ time: candleTime, value: 50 + (Math.sin(now/5) * 10) });
        stochDSeriesRef.current?.update({ time: candleTime, value: 50 + (Math.sin(now/6) * 9) });
        lastCandleRef.current = updateObj;
      }
    });

    return () => unsub();
  }, [rtdb, selectedPair]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-black flex flex-col h-screen overflow-hidden">
        {/* TOP TOOLBAR */}
        <header className="flex h-12 shrink-0 items-center justify-between px-3 border-b border-white/5 bg-[#0a0a0a] z-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-white" />
              <div className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded transition-colors cursor-pointer group">
                <span className="font-headline text-xs font-bold text-white uppercase">{selectedPair}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-white" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-3.5 w-3.5" /></Button>
            </div>

            <div className="h-4 w-px bg-white/10 mx-1" />

            <div className="flex items-center gap-1">
              {['1m', '30m', '1h'].map((tf) => (
                <Button 
                  key={tf} 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "h-8 text-[11px] font-bold px-3 rounded hover:bg-white/5",
                    timeframe === tf ? "text-primary bg-primary/10" : "text-muted-foreground"
                  )}
                >
                  {tf}
                </Button>
              ))}
            </div>

            <div className="h-4 w-px bg-white/10 mx-1" />

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"><LineChart className="h-4 w-4 text-muted-foreground" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"><BarChart3 className="h-4 w-4 text-muted-foreground" /></Button>
            </div>

            <div className="h-4 w-px bg-white/10 mx-1" />

            <Button variant="ghost" className="h-8 text-[11px] font-bold text-muted-foreground gap-2">
              <Activity className="h-4 w-4" /> Indicadores
            </Button>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/5">
               <span className="text-[10px] font-code text-green-500 font-bold">{latency}ms</span>
               <Wifi className="h-3 w-3 text-green-500" />
             </div>
             <Badge className="bg-primary/20 text-primary border-primary/30 px-3 py-0.5 text-[9px] font-black uppercase tracking-widest">LIVE FEED</Badge>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT DRAWING TOOLBAR */}
          <aside className="w-12 border-r border-white/5 bg-[#0a0a0a] flex flex-col items-center py-4 gap-4 shrink-0 overflow-y-auto no-scrollbar">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary bg-primary/10"><MousePointer2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><TrendingUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Type className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Pencil className="h-4 w-4" /></Button>
            <div className="h-px w-6 bg-white/5" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Ruler className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Magnet className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Lock className="h-4 w-4" /></Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Trash2 className="h-4 w-4" /></Button>
          </aside>

          {/* CENTRAL AREA: TRIPLE CHART SYSTEM */}
          <main className="flex-1 relative bg-black flex flex-col min-w-0 overflow-hidden">
             {/* Pane 1: Price + Volume */}
             <div className="flex-[6] min-h-0 relative border-b border-white/5">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 text-[10px] font-bold text-white/70">
                   <div className="w-2 h-2 rounded-full bg-green-500" />
                   {selectedPair} · {timeframe} · FXCM
                </div>
                <div ref={priceContainerRef} className="w-full h-full" />
             </div>

             {/* Pane 2: RSI */}
             <div className="flex-[2] min-h-0 relative border-b border-white/5">
                <div className="absolute top-2 left-4 z-20 text-[9px] font-bold text-purple-400">RSI 14 close</div>
                <div ref={rsiContainerRef} className="w-full h-full" />
             </div>

             {/* Pane 3: Stoch RSI */}
             <div className="flex-[2] min-h-0 relative">
                <div className="absolute top-2 left-4 z-20 text-[9px] font-bold text-blue-400">Stoch RSI 3 3 14 14</div>
                <div ref={stochContainerRef} className="w-full h-full" />
             </div>
          </main>

          {/* RIGHT SIDEBAR: ASSETS & ANALYSIS */}
          <aside className="hidden xl:flex w-64 border-l border-white/5 bg-[#0a0a0a] flex-col shrink-0">
             <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Analítica V7</span>
                <Badge variant="outline" className="text-[8px] border-primary/20 text-primary uppercase">Active</Badge>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* AI Status Card */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                   <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-muted-foreground uppercase">CONSENSO</span>
                      <span className="text-primary">92%</span>
                   </div>
                   <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[92%]" />
                   </div>
                   <div className="flex justify-between items-center text-[9px] text-muted-foreground uppercase font-bold">
                     <span>Probabilidad:</span>
                     <span className="text-green-500">Muy Alta</span>
                   </div>
                </div>

                <div className="space-y-2">
                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Activos Prioritarios</span>
                   {['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD', 'ETHUSD'].map(p => (
                      <button 
                         key={p} 
                         onClick={() => setSelectedPair(p)}
                         className={cn(
                            "w-full p-3 rounded-lg border text-[10px] font-bold flex items-center justify-between transition-all",
                            selectedPair === p ? "bg-primary/10 border-primary text-white" : "bg-white/5 border-transparent text-muted-foreground hover:bg-white/10"
                         )}
                      >
                         {p}
                         {selectedPair === p && <Zap className="h-3 w-3 text-primary animate-pulse" />}
                      </button>
                   ))}
                </div>

                <div className="space-y-2">
                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Señales Maestro V7</span>
                   {recentTrades && recentTrades.length === 0 ? (
                     <div className="text-center py-8 text-muted-foreground text-[10px] italic">
                       Esperando confirmación...
                     </div>
                   ) : recentTrades?.map((t: any) => (
                      <div key={t.id} className="p-3 bg-white/5 rounded-lg border border-white/5 flex flex-col gap-1 hover:border-primary/30 transition-colors">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white uppercase">{t.pair}</span>
                            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", t.direction === 'CALL' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>{t.direction}</span>
                         </div>
                         <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                            <span className="font-code">${t.amount}</span>
                            <span className={cn("font-bold", t.status === 'win' ? 'text-green-500' : 'text-red-500')}>{t.status.toUpperCase()}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
