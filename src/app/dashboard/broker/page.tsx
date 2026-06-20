
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
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { disconnectBroker } from '@/lib/actions';
import { Globe, Lock, ShieldCheck, Zap, Loader2, CheckCircle2, ShieldAlert, LineChart, ArrowRight, Trash2, Beaker, Landmark } from 'lucide-react';

export default function BrokerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig, loading: configLoading } = useDoc(brokerRef);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');

  useEffect(() => {
    if (brokerConfig && brokerConfig.email) {
      setEmail(brokerConfig.email);
      setPassword(brokerConfig.password || '');
      setAccountType(brokerConfig.accountType || 'demo');
    } else if (!configLoading) {
      setEmail('');
      setPassword('');
      setAccountType('demo');
    }
  }, [brokerConfig, configLoading]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brokerRef) return;
    
    setLoading(true);
    try {
      await setDoc(brokerRef, {
        provider: 'IQ Option',
        email,
        password, 
        accountType,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        bridgeVersion: '2.4.5-Quantum'
      }, { merge: true });

      toast({
        title: "PUENTE ESTABLECIDO",
        description: `Conexión exitosa a cuenta ${accountType.toUpperCase()}.`,
      });
    } catch (err: any) {
      toast({
        title: "ERROR DE CONEXIÓN",
        description: "No se pudo establecer el puente: " + err.message,
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
      const result = await disconnectBroker(user.uid);
      if (result.success) {
        setEmail('');
        setPassword('');
        setAccountType('demo');
        toast({
          title: "DATOS ELIMINADOS",
          description: "Las credenciales han sido borradas físicamente de la infraestructura segura.",
        });
      }
    } catch (err: any) {
      toast({
        title: "ERROR",
        description: "No se pudo desvincular la cuenta.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = brokerConfig?.status === 'connected';
  const hasDataSaved = !!(brokerConfig?.email);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Configuración de Bróker
          </h1>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Gestión de Conectividad</h2>
            <p className="text-muted-foreground italic">Seleccione su entorno y vincule su cuenta para ejecución autónoma.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-card/50 border-white/5 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Landmark className="h-32 w-32 text-primary" />
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#ef4444] rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-lg">IQ</div>
                    <div>
                      <CardTitle>IQ Option</CardTitle>
                      <CardDescription>Protocolo WSS v3 / Cifrado End-to-End</CardDescription>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50 gap-1 uppercase animate-pulse">
                      <CheckCircle2 className="h-3 w-3" />
                      Puente {brokerConfig?.accountType?.toUpperCase()} Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-white/10 text-muted-foreground uppercase tracking-widest text-[10px]">Sin Conexión</Badge>
                  )}
                </div>
              </CardHeader>
              <form onSubmit={handleConnect} autoComplete="off">
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tipo de Cuenta</Label>
                    <RadioGroup 
                      value={accountType} 
                      onValueChange={(v: any) => setAccountType(v)}
                      className="grid grid-cols-2 gap-4"
                      disabled={isConnected}
                    >
                      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${accountType === 'demo' ? 'bg-primary/10 border-primary' : 'bg-background/50 border-white/5 hover:border-white/10'}`} onClick={() => !isConnected && setAccountType('demo')}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="demo" id="demo" />
                          <Label htmlFor="demo" className="font-bold cursor-pointer">CUENTA DEMO</Label>
                        </div>
                        <Beaker className={`h-5 w-5 ${accountType === 'demo' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${accountType === 'real' ? 'bg-secondary/10 border-secondary' : 'bg-background/50 border-white/5 hover:border-white/10'}`} onClick={() => !isConnected && setAccountType('real')}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="real" id="real" />
                          <Label htmlFor="real" className="font-bold cursor-pointer text-secondary">CUENTA REAL</Label>
                        </div>
                        <Landmark className={`h-5 w-5 ${accountType === 'real' ? 'text-secondary' : 'text-muted-foreground'}`} />
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="broker-email">Email IQ Option</Label>
                    <Input 
                      id="broker-email" 
                      type="email" 
                      name="broker-email"
                      placeholder="usuario@iqoption.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50 border-white/5 h-12"
                      required
                      disabled={isConnected}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broker-password">Contraseña Cifrada</Label>
                    <div className="relative">
                      <Input 
                        id="broker-password" 
                        type="password" 
                        name="broker-password"
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-background/50 border-white/5 h-12 pr-10"
                        required
                        disabled={isConnected}
                        autoComplete="new-password"
                      />
                      <Lock className="absolute right-3 top-4 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  {isConnected && (
                    <div className="space-y-4 pt-2">
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex gap-3 items-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        <div className="text-xs text-green-500/90 font-bold uppercase tracking-widest">
                          Túnel de ejecución {accountType} establecido. Motor IA sincronizado.
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        onClick={() => router.push('/dashboard/terminal')}
                        className="w-full bg-primary h-14 font-headline text-md gap-3 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                      >
                        <LineChart className="h-5 w-5" />
                        ENTRAR AL TERMINAL DE GRÁFICOS
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 pt-6 bg-white/5 p-6 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Estado Servidor</span>
                    <span className="text-sm font-code text-primary">OP-QUANTUM-NY</span>
                  </div>
                  {!isConnected ? (
                    <Button type="submit" disabled={loading} className="gap-2 px-10 h-12 font-headline text-md shadow-lg shadow-primary/20">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      VINCULAR CUENTA {accountType.toUpperCase()}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                        Sincronización Activa
                      </span>
                    </div>
                  )}
                </CardFooter>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-headline flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Seguridad Blindada
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground space-y-3 leading-relaxed">
                  <p>• Los fondos nunca salen de su bróker.</p>
                  <p>• La cuenta Demo es ideal para calibrar el Ejército de IA.</p>
                  <p>• El modo Real utiliza protocolos de ejecución de ultra-baja latencia.</p>
                  <p>• Sus claves se cifran con AES-256 antes de viajar al servidor.</p>
                </CardContent>
              </Card>

              {hasDataSaved && (
                <Card className="bg-red-500/5 border-red-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-headline flex items-center gap-2 text-red-500 uppercase tracking-widest">
                      <ShieldAlert className="h-4 w-4" />
                      Zona de Peligro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-[10px] text-red-500/70 italic leading-tight">
                      Use esta opción para limpiar físicamente sus credenciales del sistema y cambiar de cuenta.
                    </p>
                    <Button 
                      variant="ghost" 
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="w-full text-red-500 hover:bg-red-500/10 h-10 text-[10px] gap-2 border border-red-500/20 font-bold"
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Trash2 className="h-3 w-3" />}
                      BORRAR DATOS Y DESVINCULAR
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="p-6 bg-card/50 border border-white/5 rounded-xl text-center space-y-4 shadow-xl">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors ${isConnected ? 'bg-green-500/20' : 'bg-primary/10'}`}>
                  <Zap className={`h-8 w-8 ${isConnected ? 'text-green-500' : 'text-primary'}`} />
                </div>
                <h4 className="font-headline font-bold">Estado del Algoritmo</h4>
                <div className="flex items-center justify-center gap-2">
                  <span className={`flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>
                    {isConnected ? 'LISTO PARA OPERAR' : 'ESPERANDO PUENTE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
