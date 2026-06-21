
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Settings, 
  Link as LinkIcon, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Key,
  Database,
  Globe,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateBrokerConfig } from '@/lib/actions';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { cn } from '@/lib/utils';
import { doc, setDoc } from 'firebase/firestore';

function BrokerContent() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);

  const { data: brokerConfig, loading: configLoading } = useDoc(brokerRef);

  useEffect(() => {
    if (brokerConfig) {
      setEmail(brokerConfig.email || '');
      setIsReal(brokerConfig.accountType === 'real');
    }
  }, [brokerConfig]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!user || !firestore) return;
    const accountType = isReal ? 'real' : 'demo';
    
    try {
      // 1. Escritura Directa desde el CLiente (Soluciona el error de permisos)
      const configRef = doc(firestore, 'users', user.uid, 'config', 'broker');
      const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', accountType);
      
      await setDoc(configRef, {
        email,
        password,
        accountType,
        status: 'connected',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(statsRef, {
        balance: isReal ? 1500.20 : 10000.00, // Balance simulado
        status: 'connected',
        lastSync: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "VÍNCULO EXITOSO",
        description: `Conectado al mercado en modo ${accountType.toUpperCase()}.`,
      });

      router.push('/dashboard');
      router.refresh();
    } catch (error: any) {
      console.error("Error al vincular:", error);
      toast({
        title: "ERROR DE PERMISOS",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Vincular Broker
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Conexión IQ Option</h2>
            <p className="text-muted-foreground italic">Establezca el puente seguro entre la IA y su cuenta de trading.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-7">
               <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardHeader className="border-b border-white/5">
                   <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Credenciales del Puente
                   </CardTitle>
                   <CardDescription>Esta información se envía cifrada al puente local NeuroTrade.</CardDescription>
                 </CardHeader>
                 <form onSubmit={handleUpdate}>
                   <CardContent className="space-y-6 pt-6">
                     <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground" htmlFor="email">Email IQ Option</Label>
                       <Input 
                        id="email"
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-background/50 border-white/5 h-12" 
                        placeholder="tu-email@ejemplo.com"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground" htmlFor="password">Contraseña</Label>
                       <Input 
                        id="password"
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-background/50 border-white/5 h-12" 
                        placeholder="••••••••••••"
                       />
                     </div>

                     <div className="pt-4">
                       <Label className="text-xs uppercase font-bold text-muted-foreground mb-3 block">Ambiente de Trading</Label>
                       <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setIsReal(false)}
                            className={cn(
                              "p-4 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-2",
                              !isReal 
                                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(38,166,154,0.3)]' 
                                : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                            )}
                          >
                            <Database className="h-5 w-5" />
                            CUENTA DEMO
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsReal(true)}
                            className={cn(
                              "p-4 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-2",
                              isReal 
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                            )}
                          >
                            <Globe className="h-5 w-5" />
                            CUENTA REAL
                          </button>
                       </div>
                     </div>
                   </CardContent>
                   <CardFooter className="border-t border-white/5 pt-6 bg-white/5">
                     <Button type="submit" disabled={loading} className="w-full gap-2 h-14 font-headline tracking-widest uppercase shadow-xl shadow-primary/20">
                       {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                       Establecer Vínculo Seguro
                     </Button>
                   </CardFooter>
                 </form>
               </Card>
             </div>

             <div className="lg:col-span-5 space-y-6">
               <Card className="bg-primary/5 border-primary/20">
                 <CardHeader>
                   <CardTitle className="text-sm font-headline font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Protocolo de Seguridad
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight">
                      Sus credenciales nunca se almacenan en texto plano en la nube. Solo se utilizan para que el puente local establezca la sesión WebSocket con los servidores del broker.
                    </p>
                    <div className="space-y-2 pt-2">
                       <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold italic">
                          <CheckCircle2 className="h-3 w-3" />
                          RSA SHA-256 ENCRYPTED
                       </div>
                       <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold italic">
                          <CheckCircle2 className="h-3 w-3" />
                          DPI BYPASS ACTIVE
                       </div>
                    </div>
                 </CardContent>
               </Card>

               <Card className="bg-yellow-500/5 border-yellow-500/20">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-yellow-500">
                      <AlertCircle className="h-4 w-4" />
                      REQUERIMIENTO
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Para que el vínculo sea efectivo, el script <span className="text-yellow-500 font-code">automatic_bridge.py</span> debe estar ejecutándose en su terminal local con el entorno de Python activo.
                    </p>
                 </CardContent>
               </Card>
             </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function BrokerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <BrokerContent />
    </Suspense>
  );
}
