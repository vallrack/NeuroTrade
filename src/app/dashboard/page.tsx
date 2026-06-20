
'use client';

import { useMemo, useState, useEffect } from 'react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { IACommitteeMonitor } from '@/components/dashboard/ia-committee-monitor';
import { EquityChart } from '@/components/dashboard/equity-chart';
import { LogConsole } from '@/components/dashboard/log-console';
import { KillSwitch } from '@/components/dashboard/kill-switch';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Bell, Settings, ShieldCheck, Crown, Activity, RefreshCw, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SuperAdminTools } from '@/components/dashboard/super-admin-tools';
import { Badge } from '@/components/ui/badge';
import { promoteToSuperAdmin } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [initLoading, setInitLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const botParamsRef = useMemo(() => doc(firestore, 'configuracion', 'bot_params'), [firestore]);
  const { data: botParams } = useDoc(botParamsRef);

  // Auto-inicialización de estadísticas si falta el perfil pero hay bróker
  useEffect(() => {
    if (mounted && user && firestore) {
      const checkStats = async () => {
        const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', 'current');
        const brokerRef = doc(firestore, 'users', user.uid, 'config', 'broker');
        
        const [statsSnap, brokerSnap] = await Promise.all([
          getDoc(statsRef),
          getDoc(brokerRef)
        ]);
        
        if (!statsSnap.exists() && brokerSnap.exists()) {
          const brokerData = brokerSnap.data();
          const initialBalance = brokerData.accountType === 'demo' ? 10000 : 2500;
          
          await setDoc(statsRef, {
            balance: initialBalance,
            dailyProfit: 0,
            winRate: 0,
            totalInvestment: 0,
            tradesCount: 0,
            winsCount: 0,
            lastSync: new Date().toISOString()
          }, { merge: true });
          
          toast({
            title: "SINCRONIZACIÓN AUTOMÁTICA",
            description: "Detectamos un bróker vinculado. Estadísticas inicializadas.",
          });
        }
      };
      checkStats();
    }
  }, [mounted, user, firestore, toast]);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/login');
    }
  }, [mounted, authLoading, user, router]);

  const isSuperAdmin = profile?.role === 'super-admin';
  const hasNoRole = mounted && user && profile && !profile.role;
  const isBotActive = botParams?.bot_activo;

  if (!mounted) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background overflow-x-hidden">
        <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-xl z-50">
          <div className="flex items-center gap-2 overflow-hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="hidden sm:block mr-2 h-4" />
            <div className="flex items-center gap-2 overflow-hidden">
              <h1 className="font-headline text-base md:text-lg font-bold tracking-tight text-foreground truncate max-w-[100px] xs:max-w-[140px] md:max-w-none">
                Command Center
              </h1>
              {isBotActive && (
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-0.5 px-2 md:px-3 text-[9px] md:text-[10px] hidden xs:flex">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span className="hidden md:inline">SISTEMA ACTIVO</span>
                  <span className="md:hidden">LIVE</span>
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-3">
            {isSuperAdmin && (
              <Badge variant="outline" className="hidden lg:flex border-primary/30 text-primary gap-1 bg-primary/5 uppercase text-[9px] font-bold tracking-wider">
                <Crown className="h-3 w-3" />
                Nivel Maestro
              </Badge>
            )}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 relative">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                <Settings className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          {/* Status Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-primary/5 p-4 rounded-2xl border border-white/5">
             <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className={`p-2.5 rounded-xl ${isBotActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  <Activity className={`h-5 w-5 ${isBotActive ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                   <h2 className="font-headline font-bold text-sm md:text-base leading-none">Estado de Red</h2>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                     {isBotActive ? 'Sincronizado' : 'Offline'}
                   </p>
                </div>
             </div>
             <div className="w-full sm:w-auto">
                {hasNoRole && user && (
                  <Button 
                    onClick={() => {
                      setInitLoading(true);
                      promoteToSuperAdmin(user.uid).then(res => {
                        if (res.success) toast({ title: "ACCESO MAESTRO", description: "Privilegios activados." });
                        setInitLoading(false);
                      });
                    }} 
                    variant="outline" 
                    size="sm" 
                    disabled={initLoading}
                    className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10 gap-2 h-9 text-xs"
                  >
                    {initLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Sincronizar Rango
                  </Button>
                )}
             </div>
          </div>

          <StatsGrid />
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-6">
              <EquityChart />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IACommitteeMonitor />
                <div className="space-y-6 flex flex-col">
                  {isSuperAdmin && <SuperAdminTools />}
                  <div className="flex-1 p-6 bg-card/40 border border-white/5 rounded-2xl shadow-xl backdrop-blur-sm">
                    <h3 className="font-headline font-bold mb-4 flex items-center gap-2 text-destructive text-sm uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4" />
                      Failsafe Protocols
                    </h3>
                    <KillSwitch />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="xl:col-span-4 h-full">
              <LogConsole />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
