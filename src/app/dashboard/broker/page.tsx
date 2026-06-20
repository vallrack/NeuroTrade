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
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { disconnectBroker } from '@/lib/actions';
import { Globe, ShieldCheck, Zap, Loader2, ShieldAlert, ArrowRight, Trash2, Beaker, Landmark, Coins } from 'lucide-react';

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

  const currentAccountType = brokerConfig?.accountType || 'demo';

  useEffect(() => {
    if (brokerConfig) {
      setProvider(brokerConfig.provider || 'IQ Option');
      setEmail(brokerConfig.email || '');
      setApiKey(brokerConfig.apiKey || '');
    }
  }, [brokerConfig]);

  const handleAccountTypeChange = async (type: 'demo' | 'real') => {
    if (!user || !brokerRef || loading) return;
    
    setLoading(true);
    try {
      // Cambio Atómico de Canal
      await setDoc(brokerRef, { accountType: type }, { merge: true });
      
      // Sincronización de Saldo para Demo si es necesario
      if (type === 'demo') {
        const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', 'demo');
        const snap = await getDoc(statsRef);
        if (!snap.exists()) {
          await setDoc(statsRef, {
            balance: 11046.71,
            dailyProfit: 0,
            winRate: 0,
            tradesCount: 0,
            winsCount: 0,
            lastSync: new Date().toISOString()
          });
        }
      }

      toast({
        title: `ENTORNO ${type.toUpperCase()} ACTIVADO`,
        description: `Toda la plataforma ha volcado su configuración a modo ${type === 'demo' ? 'DEMO' : 'REAL'}.`,
      });
    } catch (err) {
      toast({
        title: "ERROR DE CONMUTACIÓN",
        description: "No se pudo cambiar el entorno operativo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brokerRef) return;
    
    setLoading(true);
    try {
      await setDoc(brokerRef, {
        provider,
        email: provider === 'IQ Option' ? email : '',
        password: provider === 'IQ Option' ? password : '',
        apiKey: provider !== 'IQ Option' ? apiKey : '',
        status: 'connected',
        connectedAt: new Date().toISOString(),
      }, { merge: true });

      toast({
        title: "PUENTE ESTABLECIDO",
        description: "Comunicación total activada con el bróker.",
      });
      
      router.push('/dashboard');
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
            <p className="text-muted-foreground italic">Cambio dinámico entre entornos con volcado total de plataforma.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-card/50 border-white/5 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>Configuración de Puente</CardTitle>
                    <CardDescription>Seleccione su infraestructura de ejecución.</CardDescription>
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
                    <Label className="text-sm font-bold uppercase text-muted-foreground">Entorno de Operación Global</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange('demo')}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${currentAccountType === 'demo' ? 'bg-primary/10 border-primary ring-2 ring-primary/20 opacity-100' : 'bg-background/50 border-white/5 opacity-50 hover:opacity-80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentAccountType === 'demo' ? 'border-primary' : 'border-muted-foreground'}`}>
                            {currentAccountType === 'demo' && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <Label className="font-bold cursor-pointer uppercase">Paper / Demo</Label>
                        </div>
                        <Beaker className="h-5 w-5 opacity-50" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange('real')}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${currentAccountType === 'real' ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 opacity-100' : 'bg-background/50 border-white/5 opacity-50 hover:opacity-80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentAccountType === 'real' ? 'border-secondary' : 'border-muted-foreground'}`}>
                            {currentAccountType === 'real' && <div className="w-2 h-2 rounded-full bg-secondary" />}
                          </div>
                          <Label className="font-bold cursor-pointer uppercase">Real Account</Label>
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
                   <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     Bridge Status: Active
                   </div>
                   {!isConnected ? (
                     <Button type="submit" disabled={loading} className="gap-2 px-10 h-12 font-headline shadow-xl shadow-primary/20">
                       {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                       VINCULAR NÚCLEO
                     </Button>
                   ) : (
                     <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} className="gap-2">
                       VOLVER AL DASHBOARD <ArrowRight className="h-4 w-4" />
                     </Button>
                   )}
                </CardFooter>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="bg-card/30 border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-headline flex items-center gap-2 uppercase tracking-widest">
                    Infraestructura
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground space-y-4">
                  <div>
                    <span className="text-white font-bold block mb-1">COMUNICACIÓN TOTAL</span>
                    <p>El bot operará ininterrumpidamente en el modo elegido hasta que se detenga manualmente.</p>
                  </div>
                </CardContent>
              </Card>

              {isConnected && (
                <Card className="bg-red-500/5 border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-headline flex items-center gap-2 text-red-500 uppercase tracking-widest text-center">
                      <ShieldAlert className="h-4 w-4" />
                      Protocolo de Cierre
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setLoading(true);
                        if (user) {
                          disconnectBroker(user.uid).then(() => {
                            toast({ title: "PUENTE CERRADO", description: "Conexión finalizada por el usuario." });
                            setLoading(false);
                          });
                        }
                      }}
                      disabled={loading}
                      className="w-full text-red-500 hover:bg-red-500/10 h-10 text-[10px] gap-2 border border-red-500/20 font-bold uppercase"
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      CERRAR PUENTE
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