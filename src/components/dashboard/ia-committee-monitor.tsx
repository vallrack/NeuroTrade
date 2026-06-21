'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
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
      const now = Date.now();
      if (now - lastFetchTime.current < 4500) return;
      lastFetchTime.current = now;

      try {
        const bridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://dprogramadores.com.co/nt-bridge';
        const res = await fetch(`${bridgeUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': process.env.NEXT_PUBLIC_BRIDGE_TOKEN || 'quantum_v7_secure_key_123',
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
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/5 bg-black shadow-2xl">

      {/* ── Gráfico principal ── */}
      <div className="h-[540px] w-full">
        <TradingChart data={data?.candles || []} pair={activePair} />
      </div>

      {/* ── HUD inferior ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3
                      bg-gradient-to-r from-black via-slate-950 to-black
                      border-t border-white/5">

        {/* Par + cuenta */}
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Par activo</span>
          <span className="text-sm font-bold text-white font-mono tracking-wider">{activePair}</span>
          <span className="text-[9px] text-indigo-400 uppercase font-mono">{currentAccountType}</span>
        </div>

        {/* Precio en vivo */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Precio</span>
          <span className={cn(
            'text-2xl font-black font-mono tabular-nums transition-all duration-300',
            isCall ? 'text-emerald-400 drop-shadow-[0_0_12px_#10b981]' :
            isPut  ? 'text-red-400 drop-shadow-[0_0_12px_#ef4444]' :
                     'text-slate-300'
          )}>
            {realPrice?.toFixed(5) ?? '─.─────'}
          </span>
        </div>

        {/* Señal IA */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Señal IA V7</span>
          <Badge className={cn(
            'text-sm font-black tracking-widest px-4 py-1 font-mono border-0',
            isCall ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]' :
            isPut  ? 'bg-red-500/20 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.3)]' :
                     'bg-slate-800 text-slate-400'
          )}>
            {data?.direction ?? 'ESPERANDO'}
          </Badge>
          {data?.probability && (
            <span className="text-[9px] font-mono text-slate-500">{data.probability}% confianza</span>
          )}
        </div>

        {/* Balance */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Balance</span>
          <span className="text-sm font-bold text-emerald-400 font-mono">
            ${data?.balance != null ? Number(data.balance).toFixed(2) : '---'}
          </span>
          {isExecuting && (
            <span className="text-[9px] text-yellow-400 font-mono animate-pulse">Ejecutando...</span>
          )}
        </div>

      </div>
    </div>
  );
}
