
'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Target, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatsGrid() {
  const firestore = useFirestore();
  const [stats, setStats] = useState({
    balance: 0,
    dailyProfit: 0,
    winRate: 0,
    totalInvestment: 0
  });

  useEffect(() => {
    if (!firestore) return;
    
    const statsRef = doc(firestore, 'dashboard', 'current_stats');
    const unsub = onSnapshot(statsRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setStats(docSnapshot.data() as any);
      }
    });
    return () => unsub();
  }, [firestore]);

  const winRateColor = stats.winRate >= 65 ? 'text-green-500' : stats.winRate < 55 ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Saldo Total"
        value={`$${(stats.balance || 0).toLocaleString()}`}
        icon={<Wallet className="h-4 w-4 text-primary" />}
        subtitle="Bróker Tiempo Real"
      />
      <MetricCard
        title="Beneficio Diario"
        value={`$${(stats.dailyProfit || 0).toLocaleString()}`}
        icon={(stats.dailyProfit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
        subtitle="Rendimiento de Hoy"
        trend={(stats.dailyProfit || 0) >= 0 ? 'up' : 'down'}
      />
      <MetricCard
        title="Tasa de Acierto"
        value={`${stats.winRate || 0}%`}
        icon={<Target className="h-4 w-4 text-secondary" />}
        subtitle="Probabilidad Éxito"
        valueClassName={winRateColor}
      />
      <MetricCard
        title="Inversión Acumulada"
        value={`$${(stats.totalInvestment || 0).toLocaleString()}`}
        icon={<Activity className="h-4 w-4 text-accent" />}
        subtitle="Volumen Histórico"
      />
    </div>
  );
}

function MetricCard({ title, value, icon, subtitle, trend, valueClassName }: any) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/50 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="p-2 bg-background rounded-lg">{icon}</div>
        </div>
        <div className="flex flex-col">
          <h3 className={cn("text-2xl font-headline font-bold", valueClassName)}>{value}</h3>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary live-indicator" />
            {subtitle}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
