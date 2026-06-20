
'use client';

import { useMemo } from 'react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { IACommitteeMonitor } from '@/components/dashboard/ia-committee-monitor';
import { EquityChart } from '@/components/dashboard/equity-chart';
import { LogConsole } from '@/components/dashboard/log-console';
import { KillSwitch } from '@/components/dashboard/kill-switch';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Bell, Search, Settings, ShieldCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { SuperAdminTools } from '@/components/dashboard/super-admin-tools';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const isSuperAdmin = profile?.role === 'super-admin';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">Centro de Comando</h1>
              {isSuperAdmin && (
                <Badge variant="outline" className="border-primary/50 text-primary gap-1">
                  <Crown className="h-3 w-3" />
                  MAESTRO
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input 
                placeholder="Buscar transacciones..." 
                className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <StatsGrid />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <EquityChart />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IACommitteeMonitor />
                <div className="space-y-6">
                  {isSuperAdmin && <SuperAdminTools />}
                  <div className="p-6 bg-card/50 border border-white/5 rounded-xl">
                    <h3 className="font-headline font-bold mb-4 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-destructive" />
                      Protocolos de Emergencia
                    </h3>
                    <KillSwitch />
                  </div>
                  <div className="p-6 bg-primary/10 border border-primary/20 rounded-xl">
                    <h3 className="font-headline font-bold text-primary mb-2">Estado del Bot: ACTIVO</h3>
                    <p className="text-sm text-primary/80 mb-4">El motor está procesando patrones de EUR/USD y BTC/USD a través del Clúster Neuronal A1.</p>
                    <div className="flex gap-2">
                      <div className="h-1 flex-1 bg-primary/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-2/3 shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <LogConsole />
              <CardWithRecentTrades />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function CardWithRecentTrades() {
  return (
    <div className="bg-card/50 border border-white/5 rounded-xl p-4">
      <h3 className="font-headline font-bold text-sm mb-4 px-2">EJECUCIONES RECIENTES</h3>
      <div className="space-y-3">
        {[
          { pair: 'EUR/USD', type: 'COMPRA', price: '1.0842', result: 'WIN', time: 'hace 2m' },
          { pair: 'BTC/USD', type: 'VENTA', price: '64,231', result: 'WIN', time: 'hace 8m' },
          { pair: 'GBP/JPY', type: 'COMPRA', price: '190.12', result: 'LOSS', time: 'hace 15m' },
        ].map((trade, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-1 h-8 rounded-full ${trade.result === 'WIN' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="text-xs font-bold">{trade.pair}</p>
                <p className="text-[10px] text-muted-foreground">{trade.type} @ {trade.price}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${trade.result === 'WIN' ? 'text-green-500' : 'text-red-500'}`}>{trade.result === 'WIN' ? '+85%' : '-100%'}</p>
              <p className="text-[10px] text-muted-foreground">{trade.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
