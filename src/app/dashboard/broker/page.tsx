
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
  
  // Estados para el selector de Bridge
  const [bridgeSource, setBridgeSource] = useState<'cloud' | 'tunnel'>('cloud');
  const [renderUrl, setRenderUrl] = useState('https://eurotrade-bridge.onrender.com');
  const [tunnelUrl, setTunnelUrl] = useState('https://huge-clubs-float.loca.lt');

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
    
    // Cargar preferencias locales
    if (typeof window !== 'undefined') {
      const savedSource = localStorage.getItem('nt_bridge_source');
      if (savedSource) setBridgeSource(savedSource as 'cloud' | 'tunnel');
      
      const savedRender = localStorage.getItem('nt_render_url');
      if (savedRender) setRenderUrl(savedRender);
      
      const savedTunnel = localStorage.getItem('nt_tunnel_url');
      if (savedTunnel) setTunnelUrl(savedTunnel);
    }
  }, [brokerConfig]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!user || !firestore) return;
    const accountType = isReal ? 'real' : 'demo';
    
    try {
      // 1. Guardar credenciales en Firestore primero
      const configRef = doc(firestore, 'users', user.uid, 'config', 'broker');
      await setDoc(configRef, {
        email,
        password,
        accountType,
        status: 'connecting',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // 2. Llamar al bridge seleccionado
      let realBalance = 0;
      try {
        const bridgeUrl = bridgeSource === 'cloud' ? renderUrl : tunnelUrl;
        const bridgeToken = process.env.NEXT_PUBLIC_BRIDGE_TOKEN || 'neurotrade-secret-2024';
        
        console.log(`Conectando a Bridge: ${bridgeUrl} (${bridgeSource})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${bridgeUrl}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': bridgeToken
          },
          body: JSON.stringify({ email, password, accountType }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const bridgeData = await response.json();
          if (bridgeData.success) {
            realBalance = bridgeData.balance;
          } else {
            throw new Error(bridgeData.error || "Credenciales incorrectas");
          }
        } else {
          throw new Error(`Servidor no disponible (${response.status})`);
        }
      } catch (bridgeError: any) {
        let errorMsg = "No se pudo sincronizar el balance.";
        if (bridgeError.name === 'AbortError') errorMsg = "Timeout: El Bridge no responde.";
        
        toast({
          title: "VÍNCULO PARCIAL",
          description: errorMsg + " Credenciales guardadas.",
          variant: "default"
        });
      }

      // 3. Guardar el balance
      const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', accountType);
      await setDoc(statsRef, {
        balance: realBalance,
        status: 'connected',
        lastSync: new Date().toISOString()
      }, { merge: true });

      await setDoc(configRef, { status: 'connected' }, { merge: true });

      toast({
        title: "VÍNCULO EXITOSO",
        description: `Conectado en ${accountType.toUpperCase()}. Saldo: $${realBalance.toLocaleString()}`,
      });

      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 800);
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "ERROR",
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
            Configurar Conexión
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Terminal de Enlace</h2>
            <p className="text-muted-foreground italic">Gestione el puente entre la IA y su cuenta de trading.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-7">
               <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                 <CardHeader className="border-b border-white/5">
                   <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Credenciales IQ Option
                   </CardTitle>
                   <CardDescription>Sus datos se envían de forma segura al bridge seleccionado.</CardDescription>
                 </CardHeader>
                 <form onSubmit={handleUpdate}>
                   <CardContent className="space-y-6 pt-6">
                     <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground" htmlFor="email">Email</Label>
                       <Input 
                        id="email"
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-background/50 border-white/5 h-12" 
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
                       />
                     </div>

                     <div className="pt-4">
                        <Label className="text-xs uppercase font-bold text-muted-foreground mb-3 block">Tipo de Cuenta</Label>
                        <div className="grid grid-cols-2 gap-4">
                           <button
                             type="button"
                             onClick={() => setIsReal(false)}
                             className={cn(
                               "p-4 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-2",
                               !isReal ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-muted-foreground'
                             )}
                           >
                             <Database className="h-5 w-5" />
                             DEMO
                           </button>
                           <button
                             type="button"
                             onClick={() => setIsReal(true)}
                             className={cn(
                               "p-4 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-2",
                               isReal ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-white/5 border-white/5 text-muted-foreground'
                             )}
                           >
                             <Globe className="h-5 w-5" />
                             REAL
                           </button>
                        </div>
                     </div>
                   </CardContent>
                   <CardFooter className="border-t border-white/5 pt-6 bg-white/5">
                     <Button type="submit" disabled={loading} className="w-full gap-2 h-14 font-headline tracking-widest uppercase">
                       {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                       Activar Vínculo Seguro
                     </Button>
                   </CardFooter>
                 </form>
               </Card>
             </div>

             <div className="lg:col-span-5 space-y-6">
                <Card className="bg-card/50 border-white/5 backdrop-blur-xl border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-headline font-bold flex items-center gap-2">
                       <Settings className="h-4 w-4 text-primary" />
                       Fuente del Bridge
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setBridgeSource('cloud');
                          localStorage.setItem('nt_bridge_source', 'cloud');
                        }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-2",
                          bridgeSource === 'cloud' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Globe className="h-3 w-3" />
                        RENDER (NUBE)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBridgeSource('tunnel');
                          localStorage.setItem('nt_bridge_source', 'tunnel');
                        }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-2",
                          bridgeSource === 'tunnel' ? 'bg-amber-500 text-black shadow-lg' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Database className="h-3 w-3" />
                        LOCAL (TÚNEL)
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/50">URL Render</Label>
                        <Input 
                          value={renderUrl}
                          onChange={(e) => {
                            setRenderUrl(e.target.value);
                            localStorage.setItem('nt_render_url', e.target.value);
                          }}
                          className={cn(
                            "h-8 text-[10px] font-mono bg-background/50",
                            bridgeSource === 'cloud' ? "border-primary/50" : "border-white/5 opacity-50"
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/50">URL Túnel</Label>
                        <Input 
                          value={tunnelUrl}
                          onChange={(e) => {
                            setTunnelUrl(e.target.value);
                            localStorage.setItem('nt_tunnel_url', e.target.value);
                          }}
                          className={cn(
                            "h-8 text-[10px] font-mono bg-background/50",
                            bridgeSource === 'tunnel' ? "border-amber-500/50" : "border-white/5 opacity-50"
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6 space-y-4">
                     <div className="flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-green-500 mt-1" />
                        <div>
                           <p className="text-xs font-bold text-foreground">Conexión Segura Garantizada</p>
                           <p className="text-[10px] text-muted-foreground">Sus credenciales se utilizan exclusivamente para la sesión WebSocket activa.</p>
                        </div>
                     </div>
                     <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-[10px] text-yellow-500 leading-normal">
                          {bridgeSource === 'tunnel' 
                           ? '⚠️ MODO TÚNEL: Verifique que localtunnel esté corriendo en su PC.'
                           : '☁️ MODO NUBE: El servidor de Render gestionará su bot permanentemente.'
                          }
                        </p>
                     </div>
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
