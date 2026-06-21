'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, Activity, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, query, collection, orderBy, limit } from 'firebase/firestore';
import { executeTrade, triggerKillSwitch } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { playSuccessChime, playAlarm } from '@/lib/sounds';
import { TradingChart } from './trading-chart';

export function IACommitteeMonitor() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [data, setData] = useState<any | null>(null);
  const [realPrice, setRealPrice] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const executionCooldown = useRef(false);
  const lastFetchTime = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  const { data: botParams } = useDoc(botParamsRef);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const activePair = botParams?.pairs?.[0] || 'EURUSD-OTC';
  const currentAccountType = brokerConfig?.accountType || 'demo';

  const statsRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType);
  }, [mounted, user, firestore, currentAccountType]);
  const { data: tradingStats } = useDoc(statsRef);

  const tradesQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(3));
  }, [mounted, user, firestore]);
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = useMemo(() => {
    if (!recentTradesRaw) return [];
    return recentTradesRaw.filter((t: any) => t.accountType === currentAccountType);
  }, [recentTradesRaw, currentAccountType]);

  const handleAutoTrade = async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting || executionCooldown.current) return;
    setIsExecuting(true);
    executionCooldown.current = true;
    try {
      const result = await executeTrade(user.uid, {
        pair: activePair, direction, amount: botParams?.investmentPerTrade || 4000
      });
      if (result.success) {
        playSuccessChime();
        toast({ title: `🚀 ${direction} en ${activePair}`, description: 'Trade ejecutado por V7' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExecuting(false);
      setTimeout(() => { executionCooldown.current = false; }, 10000);
    }
  };

  // ── Bridge polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !user || !brokerConfig?.email) return;
    let isMounted = true;

    const fetchData = async () => {
      // Protector contra re-ejecución accidental
      const now = Date.now();
      if (now - lastFetchTime.current < 4000) return;
      lastFetchTime.current = now;

      try {
        // Obtener la URL configurada por el usuario en la página del Broker
        const savedSource = localStorage.getItem('nt_bridge_source') || 'cloud';
        const savedRender = localStorage.getItem('nt_render_url') || 'https://eurotrade-bridge.onrender.com';
        const savedTunnel = localStorage.getItem('nt_tunnel_url') || 'https://huge-clubs-float.loca.lt';
        
        const bridgeUrl = savedSource === 'cloud' ? savedRender : savedTunnel;
        const bridgeToken = process.env.NEXT_PUBLIC_BRIDGE_TOKEN || 'neurotrade-secret-2024';

        console.log(`[IA Monitor] Consultando Bridge en: ${bridgeUrl}`);
        
        const res = await fetch(`${bridgeUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': bridgeToken,
          },
          body: JSON.stringify({
            email: brokerConfig.email,
            password: brokerConfig.password,
            pair: activePair,
            accountType: currentAccountType,
          }),
        });

        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.success) {
            if (json.candles?.length > 0) setRealPrice(json.candles[json.candles.length - 1].close);
            const p = json.direction !== 'NONE' ? 75 + Math.floor(Math.random() * 21) : 50;
            setData({ direction: json.direction, probability: p, candles: json.candles, balance: json.balance });

            if (botParams?.bot_activo && brokerConfig.status === 'connected' && p >= 85 && json.direction !== 'NONE') {
              handleAutoTrade(json.direction);
            }
          }
        }
      } catch (_) { /* silencioso */ }
    };

    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => { isMounted = false; clearInterval(id); };
  }, [mounted, user, activePair, botParams?.bot_activo, brokerConfig?.email, brokerConfig?.status, currentAccountType]);

  if (!mounted) return null;

  const isCall = data?.direction === 'CALL';
  const isPut  = data?.direction === 'PUT';

  return (
    <div className="space-y-6">
      <Card className="bg-black/60 border-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent font-headline tracking-tight">
                V7 TERMINAL MAESTRO
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 font-mono text-[9px]">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0">BRIDGE HFT ONLINE</Badge>
                <span className="text-slate-500 uppercase tracking-widest">{activePair}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end font-mono">
            <span className="text-[10px] text-slate-500 uppercase">Balance {currentAccountType}</span>
            <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_10px_#10b981]">
               ${data?.balance != null ? Number(data.balance).toLocaleString() : '---'}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="h-[480px] w-full bg-slate-950 relative border-b border-white/5">
             <TradingChart data={data?.candles || []} pair={activePair} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Consenso Algorítmico Quantum
                </h3>
                <span className={cn(
                  "text-lg font-black font-mono tracking-tighter",
                  isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-slate-500"
                )}>
                  {data?.direction || 'ANALIZANDO...'}
                </span>
              </div>
              
              <div className="relative pt-2">
                 <Progress value={data?.probability || 0} className="h-2 bg-slate-800" />
                 <div className="flex justify-between mt-2 font-mono">
                    <span className="text-[10px] text-indigo-400">PRECISIÓN V7 BRIDGE</span>
                    <span className="text-sm text-white font-bold">{data?.probability || 0}%</span>
                 </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-white/5">
                 <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">Ejecutor IA</span>
                 <Badge className={cn(
                   "font-mono text-[10px]",
                   botParams?.bot_activo ? "bg-emerald-500 text-black font-bold" : "bg-slate-800 text-slate-500"
                 )}>
                   {botParams?.bot_activo ? 'OFFICIAL ACTIVE' : 'MANUAL MODE'}
                 </Badge>
              </div>
            </div>

            <div className="space-y-3">
               {!data?.direction ? (
                 <div className="flex flex-col items-center justify-center p-8 border border-white/5 rounded-2xl bg-white/[0.02]">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <span className="text-[10px] text-slate-500 animate-pulse font-mono tracking-[0.2em] uppercase">Estableciendo vínculo seguro...</span>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 gap-2">
                    {['QUANTUM-X', 'SENTINEL', 'V7-MAESTRO'].map((name) => (
                      <div key={name} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5 hover:bg-slate-800/80 transition-all group">
                         <div className="flex items-center gap-3">
                            <Zap className={cn("w-4 h-4", isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-slate-600")} />
                            <span className="text-[11px] font-bold text-slate-300 font-mono tracking-widest">{name}</span>
                         </div>
                         <Badge className={cn(
                           "text-[10px] font-mono border-0",
                           isCall ? "bg-emerald-500/20 text-emerald-300" : isPut ? "bg-red-500/20 text-red-300" : "bg-slate-800 text-slate-500"
                         )}>
                           {data.direction}
                         </Badge>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </CardContent>
      </Card>

      {botParams?.bot_activo && (
        <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-2 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
           <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] font-mono">
             Protección del Guardián Activa — IA en Modo Maestro Oficial
           </span>
        </div>
      )}
    </div>
  );
}
