
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { disconnectBroker } from '@/lib/actions';
import { Globe, ShieldCheck, Zap, Loader2, ShieldAlert, ArrowRight, Trash2, Beaker, Landmark } from 'lucide-react';

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
  const [apiSecret, setApiSecret] = useState('');
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');

  // Sincronizar estado inicial solo una vez o cuando cambie externamente de verdad
  useEffect(() => {
    if (brokerConfig) {
      setProvider(brokerConfig.provider || 'IQ Option');
      setEmail(brokerConfig.email || '');
      setApiKey(brokerConfig.apiKey || '');
      // Evitamos sobrescribir si el usuario acaba de cambiarlo localmente
      if (!loading) {
        setAccountType(brokerConfig.accountType || 'demo');
      }
    }
  }, [brokerConfig, loading]);

  const handleAccountTypeChange = async (type: 'demo' | 'real') => {
    if (!user || !brokerRef) return;
    
    // Actualización visual inmediata
    setAccountType(type);
    
    try {
      // Persistencia atómica en Firestore
      await setDoc(brokerRef, { accountType: type }, { merge: true });
      
      // Inicializar estadísticas del canal si no existen
      const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', type);
      const statsSnap = await getDoc(statsRef);
      
      if (!statsSnap.exists()) {
        const initialBalance = type === 'demo' ? 11046.71 : 0;
        await setDoc(statsRef, {
          balance: initialBalance,
          dailyProfit: 0,
          winRate: 0,
          totalInvestment: 0,
          tradesCount: 0,
          winsCount: 0,
          lastSync: new Date().toISOString()
        });
      }

      toast({
        title: "CANAL SINCRONIZADO",
        description: `Bot operando ahora en modo ${type.toUpperCase()}.`,
      });
    } catch (err) {
      console.error("Error al cambiar de canal:", err);
      toast({
        title: "ERROR DE PROTOCOLO",
        description: "No se pudo cambiar el canal de ejecución.",
        variant: "destructive"
      });
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brokerRef) return;
    
    setLoading(true);
    try {
      const demoBalance = 11046.71;

      await setDoc(brokerRef, {
        provider,
        email: provider === 'IQ Option' ? email : '',
        password: provider === 'IQ Option' ? password : '',
        apiKey: provider !== 'IQ Option' ? apiKey : '',
        apiSecret: provider !== 'IQ Option' ? apiSecret : '',
        accountType,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        bridgeProtocol: provider === 'IQ Option' ? 'WSS-BUYV3' : 'REST-ABSTRACTION'
      }, { merge: true });

      const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', accountType);
      const statsSnap = await getDoc(statsRef);
      if (!statsSnap.exists()) {
        await setDoc(statsRef, {
          balance: accountType === 'demo' ? demoBalance : 0,
          dailyProfit: 0,
          winRate: 0,
          totalInvestment: 0,
          tradesCount: 0,
          winsCount: 0,
          lastSync: new Date().toISOString()
        });
      }

      const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
      await setDoc(botParamsRef, {
        bot_activo: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({
        title: "PUENTE ESTABLECIDO",
        description: `Sincronización exitosa en canal ${accountType.toUpperCase()}.`,
      });
      
      router.push('/dashboard');
      
    } catch (err: any) {
      toast({
        title: "FALLO DE VÍNCULO",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await disconnectBroker(user.uid);
      setEmail('');
      setPassword('');
      setApiKey('');
      setApiSecret('');
      toast({
        title: "PUENTE CERRADO",
        description: "Sesión finalizada por el usuario.",
      });
    } catch (err: any) {
      toast({ title: "ERROR", description: "Fallo al desvincular.", variant: "destructive" });
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
            <p className="text-muted-foreground italic">Cambio dinámico entre entornos con persistencia absoluta.</p>
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
                    <Label className="text-sm font-bold uppercase text-muted-foreground">Entorno de Operación</Label>
                    <RadioGroup 
                      value={accountType} 
                      onValueChange={(v: any) => handleAccountTypeChange(v)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${accountType === 'demo' ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-background/50 border-white/5'}`}
                        onClick={() => handleAccountTypeChange('demo')}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="demo" id="demo" />
                          <Label htmlFor="demo" className="font-bold cursor-pointer uppercase">Paper / Demo</Label>
                        </div>
                        <Beaker className="h-5 w-5 opacity-50" />
                      </div>
                      <div 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${accountType === 'real' ? 'bg-secondary/10 border-secondary shadow-[0_0_20px_rgba(14,165,233,0.1)]' : 'bg-background/50 border-white/5'}`}
                        onClick={() => handleAccountTypeChange('real')}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="real" id="real" />
                          <Label htmlFor="real" className="font-bold cursor-pointer uppercase text-secondary">Real Account</Label>
                        </div>
                        <Landmark className="h-5 w-5 opacity-50" />
                      </div>
                    </RadioGroup>
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

                  {isConnected && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                       <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Canal de Datos Activo</p>
                       <p className="text-sm font-code text-white truncate">{email || apiKey || 'Conexión WSS Encriptada'}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 pt-6 bg-white/5 p-6">
                   <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     Bridge Latency: &lt;150ms
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
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-headline flex items-center gap-2 uppercase tracking-widest">
                    Infraestructura
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground space-y-4">
                  <div>
                    <span className="text-white font-bold block mb-1">IQ OPTION (WSS)</span>
                    <p>Comunicación persistente vía buyV3 para ejecución HFT de alta precisión.</p>
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
                      onClick={handleDisconnect}
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
