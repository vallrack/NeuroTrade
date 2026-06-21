
'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState, useEffect } from 'react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { IACommitteeMonitor } from '@/components/dashboard/ia-committee-monitor';
import { EquityChart } from '@/components/dashboard/equity-chart';
import { LogConsole } from '@/components/dashboard/log-console';
import { BridgeEventsLog } from '@/components/dashboard/bridge-events-log';
import { KillSwitch } from '@/components/dashboard/kill-switch';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Bell, Settings, Crown, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { SuperAdminTools } from '@/components/dashboard/super-admin-tools';
import { Badge } from '@/components/ui/badge';
import { promoteToSuperAdmin } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [initLoading, setInitLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // AISLAMIENTO DE REFERENCIAS DE FIRESTORE
  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);
  
  const { data: brokerConfig } = useDoc(brokerRef);

  const profileRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [mounted, firestore, user]);
  
  const { data: profile } = useDoc(profileRef);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  
  const { data: botParams } = useDoc(botParamsRef);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/login');
    }
  }, [mounted, authLoading, user, router]);

  const currentChannel = brokerConfig?.accountType || 'demo';
  const isBrokerConnected = brokerConfig?.status === 'connected';
  const isSuperAdmin = profile?.role === 'super-admin';
  const hasNoRole = mounted && user && profile && !profile.role;
  const isBotActive = botParams?.bot_activo;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-xl z-50">
          <div className="flex items-center gap-2 overflow-hidden">
            <SidebarTrigger />
            <Separator orientation="vertical" className="hidden sm:block mr-2 h-4" />
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-base md:text-lg font-bold tracking-tight text-white truncate max-w-[120px] xs:max-w-none">
                Command Center V7
              </h1>
              <Badge className={`border-primary/20 gap-1.5 py-0.5 px-3 text-[10px] flex ${currentChannel === 'real' ? 'bg-secondary/20 text-secondary border-secondary/30' : 'bg-primary/20 text-primary border-primary/30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${currentChannel === 'real' ? 'bg-secondary' : 'bg-primary'}`} />
                {currentChannel.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-3">
            {isSuperAdmin && (
              <Badge variant="outline" className="hidden lg:flex border-primary/30 text-primary gap-1 bg-primary/5 uppercase text-[9px] font-bold tracking-wider">
                <Crown className="h-3 w-3" />
                L-5 MASTER ACCESS
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/dashboard/settings')}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full overflow-y-auto custom-scrollbar">
          <div className={`flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl border ${currentChannel === 'real' ? 'bg-secondary/5 border-secondary/10' : 'bg-primary/5 border-primary/10'}`}>
             <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className={`p-2.5 rounded-xl ${isBotActive && isBrokerConnected ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'}`}>
                   <Activity className={`h-5 w-5 ${isBotActive && isBrokerConnected ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                   <h2 className="font-headline font-bold text-sm md:text-base leading-none uppercase">
                     PUENTE: {isBrokerConnected ? 'ACTIVO' : 'DESCONECTADO'} ({currentChannel.toUpperCase()})
                   </h2>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                     {isBrokerConnected ? (isBotActive ? 'Comunicación Bilateral Unilateral' : 'Núcleo en Hibernación') : 'Esperando Vínculo de API...'}
                   </p>
                </div>
             </div>
             <div className="w-full sm:w-auto flex gap-2">
                {!isBrokerConnected ? (
                  <Button 
                    onClick={() => router.push('/dashboard/broker')}
                    variant="default" 
                    size="sm" 
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2 h-9 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Vincular API IQ Option
                  </Button>
                ) : (
                  <Button 
                    onClick={() => router.push('/dashboard/broker')}
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto border-white/10 gap-2 h-9 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Cambiar Cuenta
                  </Button>
                )}
                {hasNoRole && user && (
                  <Button 
                    onClick={() => {
                      setInitLoading(true);
                      promoteToSuperAdmin(user.uid).then(res => {
                        if (res.success) toast({ title: "ACCESO MAESTRO", description: "Privilegios L-5 activados." });
                        setInitLoading(false);
                      });
                    }} 
                    variant="outline" 
                    size="sm" 
                    disabled={initLoading}
                    className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10 gap-2 h-9 text-xs"
                  >
                    {initLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Acceso Maestro
                  </Button>
                )}
             </div>
          </div>

          <StatsGrid />
          
          <div className="space-y-6 pb-20">

            {/* Gráfico HFT — ancho completo */}
            <IACommitteeMonitor />

            {/* Fila secundaria: Stats + Controles */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                <EquityChart />
              </div>
              <div className="xl:col-span-4 space-y-4">
                {isSuperAdmin && <SuperAdminTools />}
                <KillSwitch />
              </div>
            </div>

            {/* Eventos del sistema + Log legacy */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <BridgeEventsLog />
              <LogConsole />
            </div>

          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
