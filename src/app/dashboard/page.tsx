
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
import { doc } from 'firebase/firestore';
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
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="hidden md:block mr-2 h-4" />
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-lg md:text-xl font-bold tracking-tight text-foreground truncate max-w-[120px] md:max-w-none">Centro de Comando</h1>
              {isBotActive && (
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-0.5 md:py-1 px-2 md:px-3 ml-1 md:ml-2 text-[10px] md:text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span className="hidden xs:inline">SISTEMA AUTÓNOMO</span>
                  <span className="xs:hidden">LIVE</span>
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {isSuperAdmin && (
              <Badge variant="outline" className="hidden sm:flex border-primary/50 text-primary gap-1 bg-primary/5 uppercase text-[10px] font-bold tracking-wider">
                <Crown className="h-3 w-3" />
                Maestro
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-primary/5 p-4 rounded-xl border border-primary/10 mb-2">
             <div className="flex items-center gap-3 w-full md:w-auto">
                <div className={`p-3 rounded-full ${isBotActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  <Activity className={`h-5 w-5 md:h-6 md:w-6 ${isBotActive ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                   <h2 className="font-headline font-bold text-base md:text-lg">Estado del Motor</h2>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                     {isBotActive ? 'Operando con Autonomía' : 'Motor en Standby'}
                   </p>
                </div>
             </div>
             <div className="w-full md:w-auto">
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
                    className="w-full md:w-auto border-primary text-primary hover:bg-primary/10 gap-2"
                  >
                    {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    SINCRONIZAR RANGO
                  </Button>
                )}
             </div>
          </div>

          <StatsGrid />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <EquityChart />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IACommitteeMonitor />
                <div className="space-y-6">
                  {isSuperAdmin && <SuperAdminTools />}
                  <div className="p-4 md:p-6 bg-card/50 border border-white/5 rounded-xl shadow-xl backdrop-blur-sm">
                    <h3 className="font-headline font-bold mb-4 flex items-center gap-2 text-destructive text-sm md:text-base">
                      <ShieldCheck className="h-5 w-5" />
                      Protocolos de Emergencia
                    </h3>
                    <KillSwitch />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <LogConsole />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
