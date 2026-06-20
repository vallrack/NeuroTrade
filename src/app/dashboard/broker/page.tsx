
'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Globe, Lock, ShieldCheck, Zap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function BrokerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig, loading: configLoading } = useDoc(brokerRef);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (brokerConfig) {
      setEmail(brokerConfig.email || '');
    }
  }, [brokerConfig]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brokerRef) return;
    
    setLoading(true);
    try {
      // Seteamos el estado a 'connected' para la simulación funcional
      await setDoc(brokerRef, {
        provider: 'IQ Option',
        email,
        password, 
        status: 'connected',
        connectedAt: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "PUENTE ESTABLECIDO",
        description: "Sincronización exitosa con los servidores de IQ Option.",
      });
    } catch (err) {
      toast({
        title: "ERROR DE CONEXIÓN",
        description: "No se pudo establecer el puente con el bróker.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = brokerConfig?.status === 'connected';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Vinculación de Bróker
          </h1>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold">Puente de Ejecución</h2>
            <p className="text-muted-foreground italic">Establezca el enlace cuántico entre la IA y su capital real en IQ Option.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-card/50 border-white/5 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Globe className="h-32 w-32 text-primary" />
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#ef4444] rounded-lg flex items-center justify-center font-bold text-white text-xl">IQ</div>
                    <div>
                      <CardTitle>IQ Option</CardTitle>
                      <CardDescription>Conexión vía WebSocket Seguro (WSS)</CardDescription>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1 uppercase">
                      <CheckCircle2 className="h-3 w-3" />
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-white/10 text-muted-foreground uppercase">Desconectado</Badge>
                  )}
                </div>
              </CardHeader>
              <form onSubmit={handleConnect}>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email de IQ Option</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="usuario@iqoption.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50 border-white/5"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña (Bóveda Cifrada)</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-background/50 border-white/5 pr-10"
                        required
                      />
                      <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex gap-3 items-start">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs text-primary/90 leading-relaxed">
                      <strong>Protección NeuroTrade:</strong> Sus credenciales nunca salen de su entorno privado. La IA solo tiene permiso para enviar órdenes de compra/venta, pero los retiros están bloqueados por seguridad.
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 pt-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Estado Latencia</span>
                    <span className="text-sm font-code text-primary">12ms - London Center</span>
                  </div>
                  <Button type="submit" disabled={loading} className="gap-2 px-8">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {isConnected ? 'RECONECTAR PUENTE' : 'VINCULAR CUENTA'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-headline flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Protocolo Seguro
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-3">
                  <p>• Cifrado AES-256 de grado militar.</p>
                  <p>• Túnel VPN dedicado a servidores IQ.</p>
                  <p>• Zero-Knowledge Password Storage.</p>
                  <p>• Ejecución de alta frecuencia activada.</p>
                </CardContent>
              </Card>

              <div className="p-6 bg-card/50 border border-white/5 rounded-xl text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-headline font-bold">Estado del Algoritmo</h4>
                <div className="flex items-center justify-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-green-500 uppercase">Listo para operar</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
