
'use client';

import { useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UserCircle, Crown, ShieldCheck, Mail, Calendar, Activity, Zap, Award } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Perfil de Operador
          </h1>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-6">
          <Card className="bg-card/50 border-white/5 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Zap className="h-40 w-40 text-primary" />
            </div>
            <CardHeader className="pb-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={user?.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {profile?.displayName?.substring(0, 2).toUpperCase() || 'OP'}
                    </AvatarFallback>
                  </Avatar>
                  {profile?.role === 'super-admin' && (
                    <div className="absolute -bottom-2 -right-2 bg-primary p-1.5 rounded-full shadow-lg border-2 border-background">
                      <Crown className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center md:text-left space-y-2">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <h2 className="text-3xl font-headline font-bold">{profile?.displayName || 'Operador Quantum'}</h2>
                    <Badge className="bg-primary/20 text-primary border-primary/50 uppercase text-[10px] tracking-widest font-bold px-3">
                      {profile?.role || 'User'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {profile?.email}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Miembro desde: {new Date(profile?.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-6 bg-white/5">
              <div className="flex flex-col items-center p-4 bg-background/50 rounded-xl border border-white/5">
                <Award className="h-6 w-6 text-primary mb-2" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Rango Sistema</span>
                <span className="text-lg font-headline font-bold">{profile?.role === 'super-admin' ? 'Maestro Cuántico' : 'Operador Junior'}</span>
              </div>
              <div className="flex flex-col items-center p-4 bg-background/50 rounded-xl border border-white/5">
                <ShieldCheck className="h-6 w-6 text-green-500 mb-2" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estado Cuenta</span>
                <span className="text-lg font-headline font-bold">VERIFICADA</span>
              </div>
              <div className="flex flex-col items-center p-4 bg-background/50 rounded-xl border border-white/5">
                <Activity className="h-6 w-6 text-secondary mb-2" />
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nivel de Acceso</span>
                <span className="text-lg font-headline font-bold">L-5 ABSOLUTO</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card/50 border-white/5">
              <CardHeader>
                <CardTitle className="text-lg font-headline">Seguridad de Cuenta</CardTitle>
                <CardDescription>Gestione sus protocolos de acceso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold">Doble Factor (2FA)</span>
                    <p className="text-[10px] text-muted-foreground">Protección de nivel militar</p>
                  </div>
                  <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5">ACTIVO</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold">Alertas de Inicio</span>
                    <p className="text-[10px] text-muted-foreground">Notificar cada nueva conexión</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-white/5">
              <CardHeader>
                <CardTitle className="text-lg font-headline">Suscripción Motor IA</CardTitle>
                <CardDescription>Estado de su licencia de computación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-widest">Plan Actual</span>
                  <h4 className="text-2xl font-headline font-bold text-primary">FULL QUANTUM ACCESS</h4>
                  <p className="text-[10px] text-muted-foreground italic">Renovación automática: 20 de Julio, 2026</p>
                </div>
                <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/10 text-xs h-10">GESTIONAR FACTURACIÓN</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
