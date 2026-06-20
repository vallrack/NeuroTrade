
'use client';

import { useMemo, useState, useEffect } from 'react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { IACommitteeMonitor } from '@/components/dashboard/ia-committee-monitor';
import { EquityChart } from '@/components/dashboard/equity-chart';
import { LogConsole } from '@/components/dashboard/log-console';
import { KillSwitch } from '@/components/dashboard/kill-switch';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Bell, Settings, ShieldCheck, Crown, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { SuperAdminTools } from '@/components/dashboard/super-admin-tools';
import { Badge } from '@/components/ui/badge';
import { promoteToSuperAdmin } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [initLoading, setInitLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: profile, loading: profileLoading } = useDoc(profileRef);

  const isSuperAdmin = profile?.role === 'super-admin';
  const hasNoRole = (mounted && !authLoading && user && !profileLoading && (!profile || !profile.role));

  const handleInitialSetup = async () => {
    if (!user) return;
    setInitLoading(true);
    try {
      const result = await promoteToSuperAdmin(user.uid);
      if (result.success) {
        toast({
          title: "SISTEMA INICIALIZADO",
          description: "Has sido elevado a Super Administrador Maestro.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "ERROR DE INICIALIZACIÓN",
        description: "No se pudo establecer el rango maestro.",
      });
    } finally {
      setInitLoading(false);
    }
  };

  // Solo mostramos carga si no sabemos quién es el usuario todavía
  if (!mounted || (authLoading && !user)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-headline animate-pulse uppercase tracking-widest text-xs font-bold">Sincronizando con la Red NeuroTrade...</p>
      </div>
    );
  }

  // Si después de cargar no hay usuario, el middleware debería habernos echado, 
  // pero por seguridad devolvemos null
  if (!user) {
    return null; 
  }

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
                <Badge variant="outline" className="border-primary/50 text-primary gap-1 animate-pulse bg-primary/5">
                  <Crown className="h-3 w-3" />
                  MAESTRO
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasNoRole && (
              <Button 
                onClick={handleInitialSetup} 
                variant="outline" 
                size="sm" 
                disabled={initLoading}
                className="border-primary text-primary hover:bg-primary/10 gap-2 animate-bounce shadow-[0_0_15px_rgba(var(--primary),0.3)]"
              >
                {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                INICIALIZAR SUPER ADMIN
              </Button>
            )}
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
                  <div className="p-6 bg-card/50 border border-white/5 rounded-xl shadow-xl backdrop-blur-sm">
                    <h3 className="font-headline font-bold mb-4 flex items-center gap-2 text-destructive">
                      <ShieldCheck className="h-5 w-5" />
                      Protocolos de Emergencia
                    </h3>
                    <KillSwitch />
                  </div>
                  <div className="p-6 bg-primary/10 border border-primary/20 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Activity className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="font-headline font-bold text-primary mb-2 flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                      Estado del Bot: OPERATIVO
                    </h3>
                    <p className="text-sm text-primary/80 mb-4 pr-12">El motor cuántico está procesando flujos de datos a través de la red neuronal activa.</p>
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
