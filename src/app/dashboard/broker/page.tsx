'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Key,
  Database,
  Globe,
  Loader2,
  PowerOff,
  Monitor,
  Cloud,
  Radio,
  Wifi,
  WifiOff,
  Unplug,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { cn } from '@/lib/utils';
import { bridgeConnect, bridgeDisconnect, bridgeHealthCheck, getBridgeSource, setBridgeSource, getRenderUrl, getLocalUrl, setRenderUrl, setLocalUrl, getLocalBridgeWarning, DEFAULT_RENDER_URL, DEFAULT_LOCAL_URL } from '@/lib/bridge';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';

function BridgeStatusBanner({
  bridgeOnline,
  isConnected,
  onDisconnect,
  disconnecting,
  accountType,
}: {
  bridgeOnline: boolean | null;
  isConnected: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
  accountType: string;
}) {
  const isReal = accountType === 'real';

  if (bridgeOnline === null) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">Verificando conexión al puente...</span>
      </div>
    );
  }

  if (bridgeOnline && isConnected) {
    return (
      <div className={cn(
        "flex items-center justify-between gap-4 p-5 rounded-2xl border",
        isReal
          ? "bg-secondary/10 border-secondary/30"
          : "bg-emerald-500/10 border-emerald-500/30"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            isReal ? "bg-secondary/20" : "bg-emerald-500/20"
          )}>
            <Wifi className={cn("h-5 w-5", isReal ? "text-secondary" : "text-emerald-400")} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("font-bold text-base font-headline uppercase", isReal ? "text-secondary" : "text-emerald-400")}>
                PUENTE ACTIVO
              </span>
              <span className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                isReal ? "bg-secondary" : "bg-emerald-400"
              )} />
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Conectado en canal <span className={cn("font-bold uppercase", isReal ? "text-secondary" : "text-primary")}>{accountType}</span>
            </p>
          </div>
        </div>
        <Button
          onClick={onDisconnect}
          disabled={disconnecting}
          variant="outline"
          className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/50 gap-2 font-bold uppercase tracking-wider text-xs h-10 px-5"
        >
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
          Cerrar Conexión
        </Button>
      </div>
    );
  }

  if (bridgeOnline && !isConnected) {
    return (
      <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/20">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-base font-headline text-primary uppercase">PUENTE DISPONIBLE</p>
            <p className="text-xs text-muted-foreground">El servidor Render responde — configura tus credenciales abajo</p>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          ONLINE
        </Badge>
      </div>
    );
  }

  // Offline o desconectado
  return (
    <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/20">
          <WifiOff className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <p className="font-bold text-base font-headline text-red-400 uppercase">PUENTE OFFLINE</p>
          <p className="text-xs text-muted-foreground">El puente no responde — usa el botón "Probar" para verificar</p>
        </div>
      </div>
      {isConnected && (
        <Button
          onClick={onDisconnect}
          disabled={disconnecting}
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 text-xs h-9"
        >
          {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
          Cerrar
        </Button>
      )}
    </div>
  );
}

function BrokerContent() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { bridgeOnline } = useBotEngine();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const [bridgeSource, setBridgeSourceState] = useState<'cloud' | 'local'>('cloud');
  const [renderUrl, setRenderUrlState] = useState(DEFAULT_RENDER_URL);
  const [localUrl, setLocalUrlState] = useState(DEFAULT_LOCAL_URL);
  const [testingBridge, setTestingBridge] = useState(false);
  const [testResult, setTestResult] = useState<'online' | 'offline' | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);

  const { data: brokerConfig } = useDoc(brokerRef);
  const isConnected = brokerConfig?.status === 'connected';
  const accountType = brokerConfig?.accountType || (isReal ? 'real' : 'demo');
  const todayDate = new Date().toLocaleDateString();
  const isDayLocked = brokerConfig?.lastDefinitiveDisconnectDate === todayDate;

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
    setTestResult(null);
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
    setTestResult(null);
    try {
      const result = await bridgeHealthCheck();
      setTestResult(result.online ? 'online' : 'offline');
    } catch {
      setTestResult('offline');
    }
    setTestingBridge(false);
  };

  const handleConnect = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      if (bridgeSource === 'cloud') setRenderUrl(renderUrl);
      else setLocalUrl(localUrl);

      const result = await bridgeConnect({ email, password, accountType: isReal ? 'real' : 'demo' });

      if (result.success) {
        await setDoc(brokerRef!, {
          email, password,
          accountType: isReal ? 'real' : 'demo',
          status: 'connected',
          lastConnected: new Date()
        }, { merge: true });
        toast({ title: '✅ CONEXIÓN EXITOSA', description: 'El puente está operando.' });
      } else {
        toast({ title: '❌ ERROR DE CONEXIÓN', description: result.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'ERROR CRÍTICO', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setShowDisconnectDialog(true);
  };

  const handleDisconnectTemporal = async () => {
    if (!user || !brokerRef) return;
    setShowDisconnectDialog(false);
    setDisconnecting(true);
    try {
      await bridgeDisconnect({
        email: brokerConfig?.email || email,
        accountType: brokerConfig?.accountType || (isReal ? 'real' : 'demo'),
      });
      await updateDoc(brokerRef, { status: 'disconnected' });
      toast({ title: '🔌 PAUSA TEMPORAL', description: 'Podrás reconectar hoy si lo deseas.' });
    } catch (e: any) {
      try { await updateDoc(brokerRef, { status: 'disconnected' }); } catch {}
      toast({ title: 'SESIÓN CERRADA', description: 'Finalizada localmente en modo pausa.' });
    }
    setDisconnecting(false);
  };

  const handleDisconnectDefinitiva = async () => {
    if (!user || !brokerRef) return;
    setShowDisconnectDialog(false);
    setDisconnecting(true);
    
    // Disparar evento para guardar reporte y avanzar día
    window.dispatchEvent(new CustomEvent('nt_manual_disconnect'));

    try {
      await bridgeDisconnect({
        email: brokerConfig?.email || email,
        accountType: brokerConfig?.accountType || (isReal ? 'real' : 'demo'),
      });
      await updateDoc(brokerRef, { 
        status: 'disconnected',
        lastDefinitiveDisconnectDate: todayDate
      });
      toast({ title: '🔌 FIN DE SESIÓN', description: 'Reporte generado. ¡Vuelve mañana!' });
    } catch (e: any) {
      try { await updateDoc(brokerRef, { 
        status: 'disconnected',
        lastDefinitiveDisconnectDate: todayDate
      }); } catch {}
      toast({ title: 'SESIÓN CERRADA', description: 'Reporte generado localmente. ¡Vuelve mañana!' });
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
        {/* Estado del puente en el header */}
        <div className="flex items-center gap-2">
          {bridgeOnline === null ? (
            <Badge variant="outline" className="gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Verificando...
            </Badge>
          ) : bridgeOnline ? (
            <Badge className="gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PUENTE ONLINE
            </Badge>
          ) : (
            <Badge className="gap-1.5 text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              PUENTE OFFLINE
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-3xl font-black font-headline tracking-tighter text-white">Terminal de Enlace</h2>
          <p className="text-muted-foreground text-sm font-medium italic">Gestione el puente entre la IA y su cuenta de trading.</p>
        </div>

        {/* ─── Banner de estado prominente ─── */}
        <BridgeStatusBanner
          bridgeOnline={bridgeOnline}
          isConnected={isConnected}
          onDisconnect={handleDisconnect}
          disconnecting={disconnecting}
          accountType={accountType}
        />

        {isDayLocked && (
          <div className="mb-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm flex items-start gap-3 w-full">
            <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <strong className="block text-base mb-1">Sesión Diaria Completada</strong>
              <p>Ya realizaste la desconexión definitiva de hoy. Tu progreso de fase avanzó y tu reporte ya fue guardado en el sistema de auditoría. El botón de conexión permanecerá bloqueado hasta mañana.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ─── Credenciales ─── */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="bg-black/40 border-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
                  <Key className="w-4 h-4 text-primary" />
                  Credenciales IQ Option
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</Label>
                  <Input
                    type="email"
                    placeholder="tu-email@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || isDayLocked}
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
                    disabled={loading || isDayLocked}
                    className="bg-white/5 border-white/10 h-12 focus:ring-primary focus:border-primary transition-all font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo de Cuenta</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setIsReal(false)}
                      disabled={loading || isDayLocked}
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
                      disabled={loading || isDayLocked}
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
                  {isReal && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <p className="text-[10px] text-amber-300">Canal REAL activo — las operaciones afectan dinero real.</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex flex-col gap-3">
                <Button
                  onClick={handleConnect}
                  disabled={loading || !email || !password || isDayLocked}
                  className="w-full bg-primary hover:bg-primary/90 h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-primary/20 gap-3"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {isDayLocked ? 'Bloqueado hasta mañana' : (isConnected ? 'Reconectar Vínculo' : 'Activar Vínculo Seguro')}
                </Button>

                {isConnected && (
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="outline"
                    className="w-full h-12 rounded-2xl border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/50 font-bold uppercase tracking-widest text-xs gap-3"
                  >
                    {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                    Cerrar Conexión con el Puente
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* ─── Panel del puente ─── */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-black/60 border-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
                  <Settings className="w-4 h-4 text-orange-400" />
                  Modo del Puente Python
                </CardTitle>
                <CardDescription className="text-[10px]">El mismo bridge_server.py corre en Render o en su PC.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBridgeSourceChange('cloud')}
                    className={cn("rounded-lg text-[10px] font-bold gap-2", bridgeSource === 'cloud' ? "bg-primary text-white shadow-lg" : "text-slate-400")}
                  >
                    <Cloud className="w-3 h-3" />
                    RENDER
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBridgeSourceChange('local')}
                    className={cn("rounded-lg text-[10px] font-bold gap-2", bridgeSource === 'local' ? "bg-slate-800 text-white" : "text-slate-400")}
                  >
                    <Monitor className="w-3 h-3" />
                    MI PC
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">
                      {bridgeSource === 'cloud' ? 'URL de RENDER.COM' : 'URL de LOCALHOST'}
                    </Label>
                    <Button variant="link" size="sm" onClick={handleResetUrls} className="h-auto p-0 text-[9px] text-primary/60 hover:text-primary">
                      <RefreshCw className="w-2.5 h-2.5 mr-1" />
                      Restablecer
                    </Button>
                  </div>
                  <Input
                    value={bridgeSource === 'cloud' ? renderUrl : localUrl}
                    onChange={(e) => bridgeSource === 'cloud' ? setRenderUrlState(e.target.value) : setLocalUrlState(e.target.value)}
                    placeholder={bridgeSource === 'cloud' ? 'https://tu-app.onrender.com' : 'http://localhost:5000'}
                    className={cn("bg-white/5 border-white/10 h-10 font-mono text-[11px]", getLocalBridgeWarning() && "border-amber-500/50 text-amber-200")}
                  />
                  <p className="text-[9px] text-muted-foreground italic opacity-70">
                    {bridgeSource === 'cloud' ? 'Activo ahora: https://eurotrade-bridge.onrender.com' : 'Activo ahora: URL de túnel o red local.'}
                  </p>

                  {/* Botón de prueba con resultado integrado */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testingBridge}
                    onClick={handleTestBridge}
                    className={cn(
                      "w-full border-white/5 bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest gap-2 h-10",
                      testResult === 'online' && "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                      testResult === 'offline' && "border-red-500/30 bg-red-500/5 text-red-400"
                    )}
                  >
                    {testingBridge
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : testResult === 'online'
                        ? <CheckCircle2 className="w-3 h-3" />
                        : testResult === 'offline'
                          ? <WifiOff className="w-3 h-3" />
                          : <Radio className="w-3 h-3" />
                    }
                    {testingBridge
                      ? 'Probando...'
                      : testResult === 'online'
                        ? '✓ PUENTE RESPONDE'
                        : testResult === 'offline'
                          ? '✗ PUENTE NO DISPONIBLE'
                          : 'Probar Conexión al Puente'
                    }
                  </Button>
                </div>

                {/* Estado de conexión de broker */}
                {isConnected && (
                  <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Vínculo Activo</p>
                        <p className="text-[9px] text-muted-foreground">{brokerConfig?.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 text-[9px] font-bold"
                    >
                      {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                      Cerrar
                    </Button>
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

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent className="bg-[#1a1b26] border-white/10 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Opciones de Desconexión</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground pt-2">
              ¿Qué tipo de desconexión deseas realizar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 my-4">
            <div 
              className="p-4 rounded-lg border border-white/10 hover:border-blue-500/50 bg-black/20 hover:bg-blue-500/10 cursor-pointer transition-colors"
              onClick={handleDisconnectTemporal}
            >
              <h4 className="font-bold text-blue-400 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Pausa Temporal
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Cierra la conexión sin afectar tu día. Podrás volver a conectar el broker hoy mismo.
              </p>
            </div>
            
            <div 
              className="p-4 rounded-lg border border-white/10 hover:border-primary/50 bg-black/20 hover:bg-primary/10 cursor-pointer transition-colors"
              onClick={handleDisconnectDefinitiva}
            >
              <h4 className="font-bold text-primary flex items-center gap-2">
                <PowerOff className="h-4 w-4" /> Cierre de Sesión Definitivo
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Genera tu reporte, avanza tu fase y bloquea la conexión hasta mañana para proteger tus ganancias.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
