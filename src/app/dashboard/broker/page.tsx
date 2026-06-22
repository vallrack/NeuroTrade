'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

    setBridgeSourceState(getBridgeSource());
    setRenderUrlState(getRenderUrl());
    setLocalUrlState(getLocalUrl());
  }, [mounted, brokerConfig]);

  const handleBridgeSourceChange = (source: 'cloud' | 'local') => {
    setBridgeSourceState(source);
    setBridgeSource(source);
    setBridgeStatus('unknown');
  };

  const handleResetUrls = () => {
    if (bridgeSource === 'cloud') {
      setRenderUrl(DEFAULT_RENDER_URL);
      setRenderUrlState(DEFAULT_RENDER_URL);
    } else {
      setLocalUrl(DEFAULT_LOCAL_URL);
      setLocalUrlState(DEFAULT_LOCAL_URL);
    }
    toast({ title: 'URLs RESTABLECIDAS' });
  };

  const handleTestBridge = async () => {
    setTestingBridge(true);
    setBridgeStatus('unknown');
    try {
      const url = bridgeSource === 'cloud' ? renderUrl : localUrl;
      const isOnline = await bridgeHealthCheck(url);
      setBridgeStatus(isOnline ? 'online' : 'offline');
      setTestingMsg(isOnline ? 'CONEXIÓN EXITOSA' : 'PUENTE OFFLINE');
    } catch {
      setBridgeStatus('offline');
      setTestingMsg('FALLO DE RED');
    }
    setTestingBridge(false);
  };

  const handleConnect = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      const url = bridgeSource === 'cloud' ? renderUrl : localUrl;
      const result = await bridgeConnect(url, {
        userId: user.uid,
        email,
        password,
        accountType: isReal ? 'real' : 'demo'
      });

      if (result.success) {
        await setDoc(brokerRef!, {
          email,
          password,
          accountType: isReal ? 'real' : 'demo',
          status: 'connected',
          lastConnected: new Date()
        }, { merge: true });

        toast({ title: "CONEXIÓN EXITOSA", description: "El puente está operando." });
      } else {
        toast({ title: "ERROR DE CONEXIÓN", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "ERROR CRÍTICO", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!user || !brokerRef) return;
    setDisconnecting(true);
    try {
      const url = bridgeSource === 'cloud' ? renderUrl : localUrl;
      await bridgeDisconnect(url, user.uid);
      await updateDoc(brokerRef, { status: 'disconnected' });
      toast({ title: "PUENTE CERRADO", description: "Comunicación finalizada." });
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    }
    setDisconnecting(false);
  };

  if (!mounted) return null;

  return (
    <>
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="hidden sm:block mr-2 h-4" />
          <h1 className="font-headline text-lg font-bold tracking-tight text-white truncate">Configurar Conexión</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col gap-2 mb-6">
              <h2 className="text-3xl font-black font-headline tracking-tighter text-white">Terminal de Enlace</h2>
              <p className="text-muted-foreground text-sm font-medium italic">Gestione el puente entre la IA y su cuenta de trading.</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
             <div className="lg:col-span-7 space-y-8">
                <Card className="bg-black/40 border-white/5 backdrop-blur-xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
                      <Key className="w-4 h-4 text-primary" />
                      Credenciales IQ Option
                    </CardTitle>
                    {brokerConfig?.status === 'connected' && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 h-7 px-3 text-[9px] font-bold"
                        >
                            <PowerOff className="w-3 h-3" />
                            CERRAR COMUNICACIÓN
                        </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</Label>
                        <Input 
                            type="email" 
                            placeholder="tu-email@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            className="bg-white/5 border-white/10 h-12 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contraseña</Label>
                        <Input 
                            type="password" 
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            className="bg-white/5 border-white/10 h-12 focus:ring-primary focus:border-primary transition-all font-mono"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo de Cuenta</Label>
                        <div className="grid grid-cols-2 gap-4">
                           <button 
                             onClick={() => setIsReal(false)}
                             disabled={loading}
                             className={cn(
                               "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all duration-300",
                               !isReal 
                                 ? "bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]" 
                                 : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                             )}
                           >
                               <Database className="w-6 h-6" />
                               <span className="text-xs font-black font-headline uppercase">Demo</span>
                           </button>
                           
                           <button 
                             onClick={() => setIsReal(true)}
                             disabled={loading}
                             className={cn(
                               "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all duration-300",
                               isReal 
                                 ? "bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_0_rgba(245,158,11,0.2)]" 
                                 : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                             )}
                           >
                               <Globe className="w-6 h-6" />
                               <span className="text-xs font-black font-headline uppercase tracking-tighter">Real</span>
                           </button>
                        </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                     <Button 
                        onClick={handleConnect}
                        disabled={loading || !email || !password}
                        className="w-full bg-primary hover:bg-primary/90 h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/20 gap-3"
                     >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Activar Vínculo Seguro
                     </Button>
                  </CardFooter>
                </Card>
             </div>

             <div className="lg:col-span-5 space-y-6">
                <Card className="bg-black/60 border-white/5 backdrop-blur-xl overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4">
                      {bridgeStatus === 'online' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
                      <Settings className="w-4 h-4 text-orange-400" />
                      Modo del Puente Python
                    </CardTitle>
                    <CardDescription className="text-[10px]">El mismo bridge_server.py corre en Render o en su PC.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleBridgeSourceChange('cloud')}
                            className={cn(
                                "rounded-lg text-[10px] font-bold gap-2",
                                bridgeSource === 'cloud' ? "bg-primary text-white shadow-lg" : "text-slate-400"
                            )}
                        >
                            <Cloud className="w-3 h-3" />
                            RENDER
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleBridgeSourceChange('local')}
                            className={cn(
                                "rounded-lg text-[10px] font-bold gap-2",
                                bridgeSource === 'local' ? "bg-slate-800 text-white" : "text-slate-400"
                            )}
                        >
                            <Monitor className="w-3 h-3" />
                            MI PC
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">{bridgeSource === 'cloud' ? 'URL de RENDER.COM' : 'URL de LOCALHOST'}</Label>
                            <Button 
                                variant="link" 
                                size="sm" 
                                onClick={handleResetUrls}
                                className="h-auto p-0 text-[9px] text-primary/60 hover:text-primary transition-colors"
                            >
                                <RefreshCw className="w-2.5 h-2.5 mr-1" />
                                Resttablecer
                            </Button>
                        </div>
                        <Input 
                            value={bridgeSource === 'cloud' ? renderUrl : localUrl}
                            onChange={(e) => bridgeSource === 'cloud' ? setRenderUrlState(e.target.value) : setLocalUrlState(e.target.value)}
                            placeholder={bridgeSource === 'cloud' ? 'https://tu-app.onrender.com' : 'http://localhost:5000'}
                            className={cn(
                              "bg-white/5 border-white/10 h-10 font-mono text-[11px]",
                              getLocalBridgeWarning(bridgeSource === 'cloud' ? renderUrl : localUrl) && "border-amber-500/50 text-amber-200"
                            )}
                        />
                        <p className="text-[9px] text-muted-foreground leading-relaxed italic opacity-70">
                            {bridgeSource === 'cloud' 
                                ? 'Activo ahora: https://eurotrade-bridge.onrender.com' 
                                : 'Activo ahora: URL de túnel o red local.'}
                        </p>

                        <Button 
                            variant="outline" 
                            size="sm"
                            disabled={testingBridge}
                            onClick={handleTestBridge}
                            className="w-full border-white/5 bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest gap-2 h-10"
                        >
                            {testingBridge ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                            Probar Conexión al Puente
                        </Button>
                        
                        {testingBridge && (
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
    </>
  );
}

export default function BrokerPage() {
  return (
    <Suspense fallback={null}>
      <BrokerContent />
    </Suspense>
  );
}
