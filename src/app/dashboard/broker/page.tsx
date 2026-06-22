
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
  CheckCircle2, 
  Key,
  Database,
  Globe,
  Loader2,
  PowerOff,
  Monitor,
  Cloud,
  Radio
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { cn } from '@/lib/utils';
import { bridgeConnect, bridgeDisconnect, bridgeHealthCheck, getBridgeSource, setBridgeSource, getRenderUrl, getLocalUrl, setRenderUrl, setLocalUrl, getBridgeUrl, getLocalBridgeWarning, DEFAULT_RENDER_URL, DEFAULT_LOCAL_URL } from '@/lib/bridge';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

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
  const [disconnecting, setDisconnecting] = useState(false);
  
  const [bridgeSource, setBridgeSourceState] = useState<'cloud' | 'local'>('cloud');
  const [renderUrl, setRenderUrlState] = useState(DEFAULT_RENDER_URL);
  const [localUrl, setLocalUrlState] = useState(DEFAULT_LOCAL_URL);
  const [testingBridge, setTestingBridge] = useState(false);
  const [testingMsg, setTestingMsg] = useState('');
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    setMounted(true);
  }, []);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);

  const { data: brokerConfig, loading: configLoading } = useDoc(brokerRef);

  useEffect(() => {
    if (!mounted) return;
    if (brokerConfig) {
      setEmail(brokerConfig.email || '');
      setIsReal(brokerConfig.accountType === 'real');
    }

    // Render: si Vercel tiene NEXT_PUBLIC_BRIDGE_URL y el usuario no guardó otra, usarla
    const envRender = process.env.NEXT_PUBLIC_BRIDGE_URL;
    if (envRender && !localStorage.getItem('nt_render_url')) {
      setRenderUrl(envRender);
    }

    // Auto-correccion: si el usuario guardó una URL de tunel en modo RENDER, moverla a MI PC
    const savedRender = localStorage.getItem('nt_render_url') || '';
    const looksLikeTunnel = savedRender.includes('loca.lt') || savedRender.includes('ngrok') || savedRender.includes('localtunnel');
    const savedSource = localStorage.getItem('nt_bridge_source') || 'cloud';
    if (looksLikeTunnel && savedSource === 'cloud') {
      // Mover la URL de tunel al slot de MI PC y resetear RENDER al default
      localStorage.setItem('nt_tunnel_url', savedRender);
      localStorage.setItem('nt_render_url', 'https://eurotrade-bridge.onrender.com');
    }

    setBridgeSourceState(getBridgeSource());
    setRenderUrlState(getRenderUrl());
    setLocalUrlState(getLocalUrl());
  }, [mounted, brokerConfig]);

  const handleBridgeSourceChange = (source: 'cloud' | 'local') => {
    setBridgeSourceState(source);
    setBridgeSource(source);
    setBridgeStatus('unknown');
  };

  const handleTestBridge = async () => {
    setTestingBridge(true);
    setBridgeStatus('unknown');
    const isCloud = bridgeSource === 'cloud';
    setTestingMsg(isCloud
      ? 'Contactando Render… (puede tardar hasta 35 s si estaba dormido)'
      : 'Contactando puente local…'
    );
    try {
      const result = await bridgeHealthCheck(isCloud ? 1 : 0); // 2 intentos en cloud, 1 en local
      setBridgeStatus(result.online ? 'online' : 'offline');
      setTestingMsg('');
      toast({
        title: result.online ? 'PUENTE ONLINE ✅' : 'PUENTE OFFLINE ❌',
        description: result.online
          ? `Conectado — ${result.mode} — ${result.url}`
          : `${result.mode}: ${result.error || 'No responde'}${
              isCloud
                ? ' — ¿Render está desplegado con el bridge_server.py nuevo?'
                : ' — ¿Ejecutaste start-bridge.bat en tu PC?'
            }`,
        variant: result.online ? 'default' : 'destructive',
      });
    } finally {
      setTestingBridge(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !firestore || !brokerConfig) return;
    setDisconnecting(true);
    try {
      await bridgeDisconnect({
        email: brokerConfig.email,
        accountType: brokerConfig.accountType || 'demo',
      });

      const configRef = doc(firestore, 'users', user.uid, 'config', 'broker');
      await updateDoc(configRef, { status: 'disconnected' });

      toast({ title: "COMUNICACIÓN CERRADA", description: "Se ha desconectado del Bróker correctamente." });
    } catch (e) {
      toast({ title: "AVISO", description: "La comunicación se cerró localmente.", variant: "default" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!user || !firestore) return;
    const accountType = isReal ? 'real' : 'demo';
    
    try {
      const configRef = doc(firestore, 'users', user.uid, 'config', 'broker');
      await setDoc(configRef, {
        email, password, accountType,
        status: 'connecting',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      let realBalance = 0;
      try {
        const bridgeData = await bridgeConnect({ email, password, accountType });
        if (bridgeData.success) realBalance = bridgeData.balance ?? 0;
      } catch {
        toast({
          title: 'AVISO',
          description: bridgeSource === 'local'
            ? 'El puente local no respondió. Ejecute bridge_server.py en su PC y configure el túnel.'
            : 'El puente en Render no respondió. Verifique que el servicio esté activo.',
          variant: 'destructive',
        });
      }

      const statsRef = doc(firestore, 'users', user.uid, 'trading_stats', accountType);
      await setDoc(statsRef, { balance: realBalance, status: 'connected', lastSync: new Date().toISOString() }, { merge: true });
      await setDoc(configRef, { status: 'connected' }, { merge: true });

      toast({ title: "VÍNCULO EXITOSO", description: `Conectado en ${accountType.toUpperCase()}. Saldo: $${realBalance}` });
      setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 800);
    } catch (error: any) {
      toast({ title: "ERROR", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

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
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Key className="h-5 w-5 text-primary" />
                            Credenciales IQ Option
                        </CardTitle>
                        {brokerConfig?.status === 'connected' && (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-7 text-[9px] font-bold uppercase tracking-widest gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20"
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                            >
                                {disconnecting ? <Loader2 className="w-3 h-3 animate-spin"/> : <PowerOff className="w-3 h-3" />}
                                Cerrar Comunicación
                            </Button>
                        )}
                    </div>
                  </CardHeader>
                  <form onSubmit={handleUpdate}>
                    <CardContent className="space-y-6 pt-6">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50 border-white/5 h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Contraseña</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/50 border-white/5 h-12" />
                      </div>
                      <div className="pt-4">
                         <Label className="text-xs uppercase font-bold text-muted-foreground mb-3 block">Tipo de Cuenta</Label>
                         <div className="grid grid-cols-2 gap-4">
                            <button type="button" onClick={() => setIsReal(false)} className={cn("p-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-2", !isReal ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-muted-foreground')}>
                              <Database className="h-5 w-5" /> DEMO
                            </button>
                            <button type="button" onClick={() => setIsReal(true)} className={cn("p-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-2", isReal ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-white/5 border-white/5 text-muted-foreground')}>
                              <Globe className="h-5 w-5" /> REAL
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
                       <Settings className="h-4 w-4 text-primary" /> Modo del Puente Python
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      El mismo <code className="text-primary">bridge_server.py</code> corre en Render o en su PC.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                      <button type="button" onClick={() => handleBridgeSourceChange('cloud')} className={cn("flex-1 py-2 px-3 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-2", bridgeSource === 'cloud' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                        <Cloud className="h-3 w-3" /> RENDER
                      </button>
                      <button type="button" onClick={() => handleBridgeSourceChange('local')} className={cn("flex-1 py-2 px-3 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-2", bridgeSource === 'local' ? 'bg-amber-500 text-black' : 'text-muted-foreground')}>
                        <Monitor className="h-3 w-3" /> MI PC
                      </button>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                           <div className="flex items-center justify-between">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground/50">
                               {bridgeSource === 'cloud' ? 'URL de Render.com' : 'URL del tunel / localhost'}
                             </Label>
                             <button
                               type="button"
                               className="text-[9px] text-primary/60 hover:text-primary transition-colors font-mono"
                               onClick={() => {
                                 if (bridgeSource === 'cloud') {
                                   setRenderUrlState(DEFAULT_RENDER_URL);
                                   setRenderUrl(DEFAULT_RENDER_URL);
                                 } else {
                                   setLocalUrlState(DEFAULT_LOCAL_URL);
                                   setLocalUrl(DEFAULT_LOCAL_URL);
                                 }
                                 setBridgeStatus('unknown');
                               }}
                             >
                               &#8634; Restablecer
                             </button>
                           </div>
                           <Input
                             value={bridgeSource === 'cloud' ? renderUrl : localUrl}
                             onChange={(e) => {
                               if (bridgeSource === 'cloud') {
                                 setRenderUrlState(e.target.value);
                                 setRenderUrl(e.target.value);
                               } else {
                                 setLocalUrlState(e.target.value);
                                 setLocalUrl(e.target.value);
                               }
                               setBridgeStatus('unknown');
                             }}
                             className={cn(
                               "h-9 text-[10px] font-mono bg-background/50",
                               bridgeSource === 'cloud' && (renderUrl.includes('loca.lt') || renderUrl.includes('ngrok'))
                                 ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                                 : 'border-white/10'
                             )}
                             placeholder={bridgeSource === 'cloud' ? 'https://eurotrade-bridge.onrender.com' : 'http://127.0.0.1:5000 o https://xxx.loca.lt'}
                           />
                           {bridgeSource === 'cloud' && (renderUrl.includes('loca.lt') || renderUrl.includes('ngrok') || renderUrl.includes('tunnel')) && (
                             <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                               <p className="text-[9px] text-amber-300 font-mono leading-relaxed">
                                 <strong>URL de tunel detectada en modo RENDER.</strong> Esta URL apunta a tu PC, no a Render.
                                 <br />Haz clic en <strong>Restablecer</strong> para usar eurotrade-bridge.onrender.com
                                 <br />O cambia a modo <strong>MI PC</strong> si quieres usar el tunel.
                               </p>
                             </div>
                           )}
                           <p className={cn(
                             'text-[9px] font-mono truncate',
                             bridgeSource === 'cloud' && (renderUrl.includes('loca.lt') || renderUrl.includes('ngrok'))
                               ? 'text-amber-400'
                               : 'text-muted-foreground'
                           )}>
                             Activo ahora: {getBridgeUrl()}
                           </p>
                         </div>
                        {getLocalBridgeWarning() && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-[9px] text-red-400 leading-relaxed">{getLocalBridgeWarning()}</p>
                          </div>
                        )}

                        {bridgeSource === 'cloud' ? (
                          <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                            <p className="text-[9px] text-muted-foreground leading-relaxed">
                              <strong className="text-primary">Modo nube (24/7):</strong> Despliegue <code>bridge_server.py</code> en Render con{' '}
                              <code className="text-[8px]">gunicorn bridge_server:app</code>. Use la URL pública de Render aquí.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg space-y-2">
                            <p className="text-[9px] text-muted-foreground leading-relaxed font-bold text-amber-500">Modo local (su PC):</p>
                            <ol className="text-[9px] text-muted-foreground space-y-1 list-decimal pl-4">
                              <li>Ejecute <code>python bridge_server.py</code> o <code>start-bridge.bat</code></li>
                              <li>Si usa la app en Vercel: <code>npx localtunnel --port 5000</code></li>
                              <li>Pegue la URL del túnel (HTTPS) o <code>http://127.0.0.1:5000</code> si abre la app en <code>localhost:9002</code></li>
                            </ol>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-[10px] font-bold uppercase gap-2 border-white/10"
                          onClick={handleTestBridge}
                          disabled={testingBridge}
                        >
                          {testingBridge ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                          {testingBridge ? 'Probando…' : 'Probar conexión al puente'}
                        </Button>

                        {testingBridge && testingMsg && (
                          <p className="text-[9px] text-amber-400 font-mono text-center animate-pulse">{testingMsg}</p>
                        )}

                        {bridgeStatus !== 'unknown' && (
                          <Badge className={cn(
                            'w-full justify-center py-1 text-[9px] font-bold',
                            bridgeStatus === 'online'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          )}>
                            {bridgeStatus === 'online' ? '● PUENTE RESPONDE' : '● PUENTE NO DISPONIBLE'}
                          </Badge>
                        )}
                    </div>

                    {brokerConfig?.status === 'connected' && (
                        <div className="flex items-center gap-2 pt-4 justify-center">
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 py-1 px-4 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                VÍNCULO ACTIVO
                            </Badge>
                        </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6 space-y-4">
                     <div className="flex items-start gap-3">
                        <ShieldCheck className="h-4 w-4 text-green-500 mt-1" />
                        <div>
                           <p className="text-[11px] font-bold text-foreground font-headline">Seguridad HFT</p>
                           <p className="text-[10px] text-muted-foreground leading-relaxed">Su sesión se cifra punto a punto. Al desconectar, todos los sockets se liberan.</p>
                        </div>
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
    <Suspense fallback={null}>
      <BrokerContent />
    </Suspense>
  );
}
