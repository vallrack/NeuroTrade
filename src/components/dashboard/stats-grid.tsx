
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Target, Activity, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';

export function StatsGrid() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { liveBalance, liveProfit, liveWins, liveLosses, sessionStartBalance } = useBotEngine();

  const brokerRef = useMemo(() => user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null, [user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);
  const accountType = brokerConfig?.accountType || 'demo';

  // Calcular win rate desde contadores en tiempo real
  const totalTrades = liveWins + liveLosses;
  const winRate = totalTrades > 0 ? Math.round((liveWins / totalTrades) * 100) : 0;

  // P&L de sesión
  const sessionPnl = sessionStartBalance != null && liveBalance != null
    ? liveBalance - sessionStartBalance
    : liveProfit;

  const winRateColor = winRate >= 65 ? 'text-green-500' : winRate < 55 ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title={`Saldo ${accountType.toUpperCase()}`}
        value={liveBalance != null
          ? `$${liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '---'
        }
        icon={<Wallet className={cn("h-4 w-4", accountType === 'real' ? "text-secondary" : "text-primary")} />}
        subtitle={`Canal ${accountType.toUpperCase()}`}
        pulse={accountType === 'real'}
        live
      />
      <MetricCard
        title="P/L Sesión"
        value={`${sessionPnl >= 0 ? '+' : ''}$${sessionPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={sessionPnl >= 0
          ? <TrendingUp className="h-4 w-4 text-green-500" />
          : <TrendingDown className="h-4 w-4 text-red-500" />}
        subtitle="Rendimiento Neto"
        trend={sessionPnl >= 0 ? 'up' : 'down'}
        valueClassName={sessionPnl >= 0 ? 'text-green-400' : 'text-red-400'}
      />
      <MetricCard
        title="Win Rate V7"
        value={`${winRate}%`}
        icon={<Target className="h-4 w-4 text-secondary" />}
        subtitle={`${liveWins}W / ${liveLosses}L — ${totalTrades} ops`}
        valueClassName={winRateColor}
      />
      <MetricCard
        title="Exposición"
        value={`$${((liveWins + liveLosses) * (brokerConfig?.investmentPerTrade || 500)).toLocaleString()}`}
        icon={<Zap className="h-4 w-4 text-accent" />}
        subtitle="Volumen de Sesión"
      />
    </div>
  );
}

function MetricCard({ title, value, icon, subtitle, trend, valueClassName, pulse, live }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle: string;
  trend?: 'up' | 'down';
  valueClassName?: string;
  pulse?: boolean;
  live?: boolean;
}) {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-white/5 hover:border-primary/40 transition-all duration-500 group relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 w-full h-[2px] transition-all",
        trend === 'up' ? "bg-green-500/0 group-hover:bg-green-500/30" : "bg-primary/0 group-hover:bg-primary/30")} />
      {live && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        </div>
      )}
      <CardContent className="p-4 md:p-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
          <div className="p-1.5 md:p-2 bg-[#0a0f1a] rounded-xl border border-white/5">
            {icon}
          </div>
        </div>
        <div className="flex flex-col">
          <h3 className={cn("text-xl md:text-2xl font-headline font-bold tracking-tight truncate", valueClassName)}>{value}</h3>
          <p className="text-[8px] md:text-[9px] text-muted-foreground mt-2 flex items-center gap-1.5 font-bold uppercase tracking-widest">
            <span className={cn("w-1.5 h-1.5 rounded-full bg-primary", pulse ? "animate-ping" : "live-indicator")} />
            {subtitle}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
