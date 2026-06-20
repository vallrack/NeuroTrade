'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { syncBrokerProfile, disconnectBroker } from '@/lib/actions';
import { Globe, Zap, Loader2, ShieldAlert, ArrowRight, Trash2, Beaker, Landmark } from 'lucide-react';

export default function BrokerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const [provider, setProvider] = useState<string>('IQ Option');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');

  useEffect(() => {
    if (brokerConfig) {
      setProvider(brokerConfig.provider || 'IQ Option');
      setEmail(brokerConfig.email || '');
      setApiKey(brokerConfig.apiKey || '');
      setAccountType(brokerConfig.accountType || 'demo');
    }
  }, [brokerConfig]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brokerRef) return;
    
    setLoading(true);
    try {
      const brokerData = {
        provider,
        email: provider === 'IQ Option' ? email : '',
        password: provider === 'IQ Option' ? password : '',
        apiKey: provider !== 'IQ Option' ? apiKey : '',
        accountType,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      };

      // 1. Guardar credenciales
      await setDoc(brokerRef, brokerData, { merge: true });

      // 2. Sincronización Automática con la API de IQ Option
      const syncResult = await syncBrokerProfile(user.uid, brokerData);
      
      if (syncResult.success) {
        toast({
          title: "PUENTE ESTABLECIDO CON ÉXITO",
          description: `Se ha identificado la cuenta ${accountType.toUpperCase()} con balance real de la API.`,
        });
        router.push('/dashboard');
      } else {
        throw new Error(syncResult.error);
      }
    } catch (err: any) {
      toast({ title: "FALLO DE VÍNCULO", description: err.message, variant: "destructive" });
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
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2 uppercase">
            <Globe className="h-5 w-5 text-primary" />
            Vínculo de Bróker V7
          </h1>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Gestión de Conectividad</h2>
            <p className="text-muted-foreground italic">Identificación automática de cuentas mediante el puente oficial.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-card/50 border-white/5 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>Configuración de Puente</CardTitle>
                    <CardDescription>Conecte su cuenta para sincronización de API.</CardDescription>
                  </div>
                  {isConnected && (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50 uppercase">
                      Sincronizado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <form onSubmit={handleConnect} className="space-y-6">
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Proveedor del Mercado</Label>
                    <Select value={provider} onValueChange={setProvider} disabled={isConnected}>
                      <SelectTrigger className="bg-background/50 border-white/5 h-12">
                        <SelectValue placeholder="Seleccione bróker" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IQ Option">IQ Option (Binarias/Forex)</SelectItem>
                        <SelectItem value="Alpaca">Alpaca Markets</SelectItem>
                        <SelectItem value="Binance">Binance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold uppercase text-muted-foreground">Tipo de Cuenta a Vincular</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        disabled={isConnected}
                        onClick={() => setAccountType('demo')}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${accountType === 'demo' ? 'bg-primary/10 border-primary ring-2 ring-primary/20 opacity-100' : 'bg-background/50 border-white/5 opacity-50 hover:opacity-80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Label className="font-bold cursor-pointer uppercase">Demo</Label>
                        </div>
                        <Beaker className="h-5 w-5 opacity-50" />
                      </button>

                      <button
                        type="button"
                        disabled={isConnected}
                        onClick={() => setAccountType('real')}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${accountType === 'real' ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 opacity-100' : 'bg-background/50 border-white/5 opacity-50 hover:opacity-80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Label className="font-bold cursor-pointer uppercase">Real</Label>
                        </div>
                        <Landmark className="h-5 w-5 opacity-50" />
                      </button>
                    </div>
                  </div>

                  {!isConnected && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {provider === 'IQ Option' ? (
                        <>
                          <div className="space-y-2">
                            <Label>Email IQ Option</Label>
                            <Input 
                              type="email" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="bg-background/50 border-white/5 h-12"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Clave de Acceso</Label>
                            <Input 
                              type="password" 
                              value={password} 
                              onChange={(e) => setPassword(e.target.value)}
                              className="bg-background/50 border-white/5 h-12"
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="bg-background/50 border-white/5 h-12"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 pt-6 bg-white/5 p-6">
                   {!isConnected ? (
                     <Button type="submit" disabled={loading} className="w-full gap-2 h-12 font-headline shadow-xl shadow-primary/20">
                       {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                       ABRIR PUENTE CON API
                     </Button>
                   ) : (
                     <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} className="w-full gap-2">
                       IR AL CENTRO DE MANDO <ArrowRight className="h-4 w-4" />
                     </Button>
                   )}
                </CardFooter>
              </form>
            </Card>

            <div className="space-y-6">
              {isConnected && (
                <Card className="bg-red-500/5 border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-headline flex items-center gap-2 text-red-500 uppercase tracking-widest">
                      <ShieldAlert className="h-4 w-4" />
                      Cerrar Puente Actual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setLoading(true);
                        if (user) {
                          disconnectBroker(user.uid).then(() => {
                            toast({ title: "PUENTE CERRADO", description: "Vínculo finalizado para cambio de cuenta." });
                            setLoading(false);
                          });
                        }
                      }}
                      disabled={loading}
                      className="w-full text-red-500 hover:bg-red-500/10 h-10 text-[10px] gap-2 border border-red-500/20 font-bold uppercase"
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      DESVINCULAR CUENTA
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
