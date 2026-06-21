
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { useRTDB } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref as rtdbRef, onValue } from 'firebase/database';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Target, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function StatsGrid() {
  const { user } = useUser();
  const firestore = useFirestore();
  const rtdb = useRTDB();
  const [stats, setStats] = useState({
    balance: 0,
    dailyProfit: 0,
    winRate: 0,
    totalInvestment: 0
  });

  const brokerRef = useMemo(() => user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null, [user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);
  const accountType = brokerConfig?.accountType || 'demo';

  useEffect(() => {
    if (!firestore || !rtdb || !user) return;
    
    // ESCUCHA DINÁMICA FIRESTORE (Estadísticas como P/L, trades, etc.)
    const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', accountType);
    
    const unsubFirestore = onSnapshot(
      statsRef, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const trades = data.tradesCount || 0;
          const wins = data.winsCount || 0;
          const winRate = trades > 0 ? Math.round((wins / trades) * 100) : 0;
          
          setStats(prev => ({
            ...prev,
            dailyProfit: data.dailyProfit || 0,
            totalInvestment: data.totalInvestment || 0,
            winRate: winRate,
            // Inicializar balance con Firestore por si RTDB tarda o no existe
            balance: prev.balance === 0 ? (data.balance || (accountType === 'demo' ? 11046.71 : 0)) : prev.balance
          }));
        } else {
          setStats(prev => ({
             ...prev,
            balance: accountType === 'demo' ? 11046.71 : 0,
            dailyProfit: 0,
            winRate: 0,
            totalInvestment: 0
          }));
        }
      },
      (error) => {
        const permissionError = new FirestorePermissionError({ path: statsRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    // ESCUCHA DIRECA AL PUENTE (RTDB) - SOLO PARA BALANCE EN TIEMPO REAL
    const bridgeRef = rtdbRef(rtdb, `users/${user.uid}/trading_stats/${accountType}`);
    const unsubRTDB = onValue(bridgeRef, (snapshot) => {
      if (snapshot.exists()) {
        const bridgeData = snapshot.val();
        if (bridgeData && bridgeData.balance !== undefined) {
          setStats(prev => ({ ...prev, balance: bridgeData.balance }));
        }
      }
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  }, [firestore, rtdb, user, accountType]);

  const winRateColor = stats.winRate >= 65 ? 'text-green-500' : stats.winRate < 55 ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title={`Saldo ${accountType.toUpperCase()}`}
        value={`$${(stats.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={<Wallet className={cn("h-4 w-4", accountType === 'real' ? "text-secondary" : "text-primary")} />}
        subtitle={`Canal ${accountType.toUpperCase()}`}
        pulse={accountType === 'real'}
      />
      <MetricCard
        title="P/L Diario"
        value={`$${(stats.dailyProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={(stats.dailyProfit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
        subtitle="Rendimiento Neto"
        trend={(stats.dailyProfit || 0) >= 0 ? 'up' : 'down'}
      />
      <MetricCard
        title="Win Rate V7"
        value={`${stats.winRate || 0}%`}
        icon={<Target className="h-4 w-4 text-secondary" />}
        subtitle="Precisión IA"
        valueClassName={winRateColor}
      />
      <MetricCard
        title="Volumen"
        value={`$${(stats.totalInvestment || 0).toLocaleString()}`}
        icon={<Zap className="h-4 w-4 text-accent" />}
        subtitle="Exposición"
      />
    </div>
  );
}

function MetricCard({ title, value, icon, subtitle, trend, valueClassName, pulse }: any) {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-white/5 hover:border-primary/40 transition-all duration-500 group relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 w-full h-[2px] transition-all", trend === 'up' ? "bg-green-500/0 group-hover:bg-green-500/30" : "bg-primary/0 group-hover:bg-primary/30")} />
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
