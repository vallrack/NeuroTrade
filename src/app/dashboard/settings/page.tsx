
'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { updateBotConfig } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Settings2, Cpu, Loader2, RefreshCw, Zap, Clock, ShieldAlert, 
  Target, Plus, Trash2, Sliders, Globe, Activity, Landmark, ShieldCheck, 
  Wallet, Gauge, BarChart3, Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function SettingsV7Page() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  const [isEditing, setIsEditing] = useState(false);
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);

  const [botActive, setBotActive] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [takeProfit, setTakeProfit] = useState('60000');
  const [stopLoss, setStopLoss] = useState('8000');
  const [minBalance, setMinBalance] = useState('2000');
  const [investment, setInvestment] = useState('4000');
  const [maxTrades, setMaxTrades] = useState('1');
  const [maxLosses, setMaxLosses] = useState('2');
  const [minRsi, setMinRsi] = useState('20');
  const [midRsi, setMidRsi] = useState('38');
  const [maxRsi, setMaxRsi] = useState('62');
  const [martingale, setMartingale] = useState(false);
  const [pairs, setPairs] = useState<string[]>(['EURUSD-OTC', 'GBPUSD-OTC']);
  const [newPair, setNewPair] = useState('');
  const [schedules, setSchedules] = useState<{start: string, end: string}[]>([]);

  useEffect(() => {
    if (botParams && !isEditing) {
      setBotActive(botParams.bot_activo !== undefined ? botParams.bot_activo : true);
      setTakeProfit(botParams.takeProfit?.toString() || '60000');
      setStopLoss(botParams.stopLoss?.toString() || '8000');
      setMinBalance(botParams.minBalance?.toString() || '2000');
      setInvestment(botParams.investmentPerTrade?.toString() || '4000');
      setMaxTrades(botParams.maxTradesPerDay?.toString() || '1');
      setMaxLosses(botParams.maxLosses?.toString() || '2');
      setMinRsi(botParams.minRsi?.toString() || '20');
      setMidRsi(botParams.midRsi?.toString() || '38');
      setMaxRsi(botParams.maxRsi?.toString() || '62');
      setMartingale(!!botParams.martingale);
      setPairs(botParams.pairs || ['EURUSD-OTC', 'GBPUSD-OTC']);
      setSchedules(botParams.schedules || [{start: '07:00', end: '09:00'}]);
    }
  }, [botParams, isEditing]);

  useEffect(() => {
    if (brokerConfig) {
      setEmail(brokerConfig.email || '');
      setPassword(brokerConfig.password || '');
    }
  }, [brokerConfig]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const config = {
      bot_activo: botActive,
      takeProfit: parseFloat(takeProfit),
      stopLoss: parseFloat(stopLoss),
      minBalance: parseFloat(minBalance),
      investmentPerTrade: parseFloat(investment),
      maxTradesPerDay: parseInt(maxTrades),
      maxLosses: parseInt(maxLosses),
      minRsi: parseFloat(minRsi),
      midRsi: parseFloat(midRsi),
      maxRsi: parseFloat(maxRsi),
      martingale,
      pairs,
      schedules
    };

    try {
      if (user && brokerRef) {
        await setDoc(brokerRef, { email, password }, { merge: true });
      }
      const result = await updateBotConfig(config);
      if (result.success) {
        toast({ title: "NÚCLEO V7 ACTUALIZADO", description: "Protocolos sincronizados exitosamente." });
      }
    } catch (err) {
      toast({ title: "ERROR DE GUARDADO", description: "No se pudo sincronizar el núcleo.", variant: "destructive" });
    } finally {
      setLoading(false);
      setIsEditing(false);
    }
  }

  const addPair = () => {
    const formatted = newPair.trim().toUpperCase();
    if (formatted && !pairs.includes(formatted)) {
      setPairs([...pairs, formatted]);
      setNewPair('');
      setIsEditing(true);
    }
  };

  const removePair = (p: string) => {
    setPairs(pairs.filter(pair => pair !== p));
    setIsEditing(true);
  };

  const addSchedule = () => {
    setSchedules([...schedules, {start: '07:00', end: '09:00'}]);
    setIsEditing(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#0b101b]">
        <header className="flex h-16 items-center justify-between px-8 border-b border-white/5 bg-background/40 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="h-4 w-px bg-white/10 mx-2" />
            <div className="flex flex-col">
              <h1 className="font-headline text-lg font-bold flex items-center gap-2 text-white">
                <Settings2 className="h-5 w-5 text-primary" />
                CONFIGURACIÓN NÚCLEO V7
              </h1>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Protocolo Operativo Maestro</span>
            </div>
          </div>
        </header>
        
        <main className="p-8 space-y-8 max-w-[1400px] mx-auto">
          {paramsLoading ? (
             <div className="flex flex-col items-center justify-center py-40 gap-4">
               <RefreshCw className="h-10 w-10 text-primary animate-spin" />
               <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Desencriptando parámetros V7...</p>
             </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUMNA 1: ACCESO Y GESTIÓN DE CAPITAL */}
                <div className="space-y-6">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        TERMINAL DE ACCESO
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase">Bróker IQ Option</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Email Bróker</Label>
                        <Input 
                          placeholder="email@dominio.com" 
                          value={email} 
                          onChange={e => {setEmail(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Contraseña Cifrada</Label>
                        <Input 
                          type="password" 
                          placeholder="**********" 
                          value={password} 
                          onChange={e => {setPassword(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-11"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        GESTIÓN DE CAPITAL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Ganancia Meta - TP ($)</Label>
                          <Input 
                            type="number" 
                            value={takeProfit} 
                            onChange={e => {setTakeProfit(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-11 text-green-500 font-bold"
                          />
                          <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="h-3 w-3" /> Meta diaria: el bot se detendrá al ganar esto.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Pérdida Máxima - SL ($)</Label>
                          <Input 
                            type="number" 
                            value={stopLoss} 
                            onChange={e => {setStopLoss(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-11 text-red-500 font-bold"
                          />
                          <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="h-3 w-3" /> Límite de seguridad: apaga el bot si se pierde esto.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Mantenimiento de Saldo ($)</Label>
                          <Input 
                            type="number" 
                            value={minBalance} 
                            onChange={e => {setMinBalance(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-11 font-bold"
                          />
                          <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="h-3 w-3" /> Saldo mínimo en bróker para operar.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* COLUMNA 2: REGLAS DE TRADING Y RSI */}
                <div className="space-y-6">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden hover:border-primary/20 transition-all duration-300 h-full">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-primary" />
                        REGLAS DE EJECUCIÓN V7
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                        <Label className="text-[11px] uppercase text-primary font-black tracking-widest">Inversión Maestra ($)</Label>
                        <Input 
                          type="number" 
                          value={investment} 
                          onChange={e => {setInvestment(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/60 border-primary/30 h-14 text-2xl text-center text-primary font-headline font-bold"
                        />
                        <p className="text-[10px] text-primary/70 text-center font-bold uppercase tracking-wider">
                          Monto fijo por operación HFT
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Pérdidas Seguidas Permitidas</Label>
                          <Input 
                            type="number" 
                            value={maxLosses} 
                            onChange={e => {setMaxLosses(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-11 text-center font-bold text-red-500"
                          />
                          <p className="text-[9px] text-muted-foreground text-center italic">Si el bot pierde N veces seguidas, se apaga por seguridad.</p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Gauge className="h-4 w-4 text-primary" />
                          <Label className="text-[11px] uppercase font-bold tracking-widest">Umbrales de RSI Cuántico</Label>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1 text-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Mín (20)</span>
                            <Input type="number" value={minRsi} onChange={e => {setMinRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-10 text-center font-bold" />
                          </div>
                          <div className="space-y-1 text-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Med (38)</span>
                            <Input type="number" value={midRsi} onChange={e => {setMidRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-10 text-center font-bold text-primary" />
                          </div>
                          <div className="space-y-1 text-center">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground">Máx (62)</span>
                            <Input type="number" value={maxRsi} onChange={e => {setMaxRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-10 text-center font-bold" />
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground text-center italic leading-tight">
                          Calibración V7 para detectar reversiones en temporalidad de 1 min.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* COLUMNA 3: ACTIVOS Y HORARIOS */}
                <div className="space-y-6">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        CLÚSTERS DE ACTIVOS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Ej: EURUSD-OTC" 
                          value={newPair} 
                          onChange={e => setNewPair(e.target.value)}
                          className="bg-zinc-900/50 border-white/10 h-10 flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPair())}
                        />
                        <Button type="button" onClick={addPair} size="icon" className="h-10 w-10 bg-primary">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {pairs.map(p => (
                          <div key={p} className="flex items-center justify-between p-3 bg-zinc-900/40 rounded-xl border border-white/5 group hover:border-primary/40 transition-all">
                            <div className="flex items-center gap-3">
                              <Checkbox checked className="data-[state=checked]:bg-primary" />
                              <span className="text-xs font-bold uppercase tracking-widest text-white/90">{p}</span>
                            </div>
                            <button type="button" onClick={() => removePair(p)} className="bg-red-500/10 hover:bg-red-500 p-2 rounded-lg transition-all">
                              <Trash2 className="h-3.5 w-3.5 text-red-500 group-hover:text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden hover:border-primary/20 transition-all duration-300">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        VENTANAS OPERATIVAS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Horarios V7</span>
                        <Button type="button" variant="outline" size="sm" onClick={addSchedule} className="h-7 text-[10px] border-primary/30 text-primary hover:bg-primary/10">
                          + Nueva Ventana
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {schedules.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-900/40 rounded-xl border border-white/5">
                            <Input 
                              type="text" 
                              value={s.start} 
                              onChange={e => {
                                const newScheds = [...schedules];
                                newScheds[idx].start = e.target.value;
                                setSchedules(newScheds);
                                setIsEditing(true);
                              }}
                              className="bg-zinc-900/50 border-white/10 h-8 text-center text-xs font-bold" 
                            />
                            <span className="text-xs text-muted-foreground">A</span>
                            <Input 
                              type="text" 
                              value={s.end} 
                              onChange={e => {
                                const newScheds = [...schedules];
                                newScheds[idx].end = e.target.value;
                                setSchedules(newScheds);
                                setIsEditing(true);
                              }}
                              className="bg-zinc-900/50 border-white/10 h-8 text-center text-xs font-bold" 
                            />
                            <button type="button" onClick={() => setSchedules(schedules.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="fixed bottom-8 right-8 z-30">
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="h-16 px-10 rounded-2xl bg-primary text-white font-headline text-lg font-bold shadow-2xl shadow-primary/30 hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-4"
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />}
                  GUARDAR Y SINCRONIZAR NÚCLEO V7
                </Button>
              </div>
            </form>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
