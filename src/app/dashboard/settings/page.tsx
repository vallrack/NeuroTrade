'use client';

export const dynamic = 'force-dynamic';

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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings2, Cpu, Loader2, RefreshCw, Zap, Clock, ShieldAlert, 
  Target, Plus, Trash2, Sliders, Globe, Activity, Landmark, ShieldCheck, 
  Wallet, Gauge, BarChart3, Info, Send, ShieldPlus
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
  const [riskMode, setRiskMode] = useState('Fijo');
  const [newsFilter, setNewsFilter] = useState(true);
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
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
      setRiskMode(botParams.riskMode || 'Fijo');
      setNewsFilter(botParams.newsFilter !== undefined ? botParams.newsFilter : true);
      setTgToken(botParams.tgToken || '');
      setTgChatId(botParams.tgChatId || '');
      setPairs(botParams.pairs || ['EURUSD-OTC', 'GBPUSD-OTC']);
      setSchedules(botParams.schedules || [{start: '07:00', end: '23:00'}]);
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
      riskMode,
      newsFilter,
      tgToken,
      tgChatId,
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
        <header className="flex h-16 shrink-0 items-center justify-between px-4 md:px-8 border-b border-white/5 bg-background/40 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 md:gap-4">
            <SidebarTrigger />
            <div className="hidden xs:block h-4 w-px bg-white/10 mx-2" />
            <div className="flex flex-col">
              <h1 className="font-headline text-sm md:text-lg font-bold flex items-center gap-2 text-white">
                <Settings2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="hidden xs:inline">CONFIGURACIÓN NÚCLEO V7</span>
                <span className="xs:hidden">CONFIG V7</span>
              </h1>
              <span className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Protocolo Maestro</span>
            </div>
          </div>
        </header>
        
        <main className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto">
          {paramsLoading ? (
             <div className="flex flex-col items-center justify-center py-40 gap-4">
               <RefreshCw className="h-10 w-10 text-primary animate-spin" />
               <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Desencriptando...</p>
             </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 md:pb-32">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* COLUMNA 1: ACCESO Y RIESGO */}
                <div className="space-y-6">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <Globe className="h-4 w-4 text-primary" />
                        Terminal Acceso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Email Bróker</Label>
                        <Input 
                          placeholder="email@dominio.com" 
                          value={email} 
                          onChange={e => {setEmail(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-10 md:h-11 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Contraseña</Label>
                        <Input 
                          type="password" 
                          placeholder="**********" 
                          value={password} 
                          onChange={e => {setPassword(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-10 md:h-11 text-xs"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden">
                    <CardHeader className="bg-secondary/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <ShieldPlus className="h-4 w-4 text-secondary" />
                        Estrategia de Riesgo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Modo de Operación</Label>
                          <Select value={riskMode} onValueChange={v => {setRiskMode(v); setIsEditing(true);}}>
                            <SelectTrigger className="bg-zinc-900/50 border-white/10 h-10 md:h-11 text-xs">
                              <SelectValue placeholder="Seleccione modo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fijo">Fijo (Standard)</SelectItem>
                              <SelectItem value="Interés Compuesto">Interés Compuesto</SelectItem>
                              <SelectItem value="Martingala">Martingala (Riesgo Alto)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-white/10">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-bold uppercase">Filtro Noticias</Label>
                            <p className="text-[8px] text-muted-foreground">Pausa ±15 min (3 Toros)</p>
                          </div>
                          <Switch checked={newsFilter} onCheckedChange={v => {setNewsFilter(v); setIsEditing(true);}} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden">
                    <CardHeader className="bg-blue-500/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <Send className="h-4 w-4 text-blue-500" />
                        Notificaciones Telegram
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Bot Token</Label>
                        <Input 
                          placeholder="ABC:123-token" 
                          value={tgToken} 
                          onChange={e => {setTgToken(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-10 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Chat ID</Label>
                        <Input 
                          placeholder="987654321" 
                          value={tgChatId} 
                          onChange={e => {setTgChatId(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/50 border-white/10 h-10 text-xs"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* COLUMNA 2: REGLAS DE TRADING */}
                <div className="space-y-6">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden h-full">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <Sliders className="h-4 w-4 text-primary" />
                        Reglas Ejecución
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                        <Label className="text-[10px] uppercase text-primary font-black tracking-widest">Inversión Maestro (COP)</Label>
                        <Input 
                          type="number" 
                          value={investment} 
                          onChange={e => {setInvestment(e.target.value); setIsEditing(true);}} 
                          className="bg-zinc-900/60 border-primary/30 h-12 md:h-14 text-xl md:text-2xl text-center text-primary font-headline font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Pérdidas Cons.</Label>
                          <Input 
                            type="number" 
                            value={maxLosses} 
                            onChange={e => {setMaxLosses(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-10 text-center font-bold text-red-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Balance Mín.</Label>
                          <Input 
                            type="number" 
                            value={minBalance} 
                            onChange={e => {setMinBalance(e.target.value); setIsEditing(true);}} 
                            className="bg-zinc-900/50 border-white/10 h-10 text-center font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Gauge className="h-4 w-4 text-primary" />
                          <Label className="text-[10px] uppercase font-bold tracking-widest">RSI Cuántico</Label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1 text-center">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">Mín (Buy)</span>
                            <Input type="number" value={minRsi} onChange={e => {setMinRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-9 text-center font-bold text-xs px-1" />
                          </div>
                          <div className="space-y-1 text-center">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">Equil.</span>
                            <Input type="number" value={midRsi} onChange={e => {setMidRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-9 text-center font-bold text-primary text-xs px-1" />
                          </div>
                          <div className="space-y-1 text-center">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">Máx (Sell)</span>
                            <Input type="number" value={maxRsi} onChange={e => {setMaxRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-900/50 border-white/10 h-9 text-center font-bold text-xs px-1" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* COLUMNA 3: ACTIVOS Y HORARIOS */}
                <div className="space-y-6 md:col-span-2 lg:col-span-1">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Clústers Activos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="EURUSD-OTC" 
                          value={newPair} 
                          onChange={e => setNewPair(e.target.value)}
                          className="bg-zinc-900/50 border-white/10 h-10 flex-1 text-xs"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPair())}
                        />
                        <Button type="button" onClick={addPair} size="icon" className="h-10 w-10 bg-primary shrink-0">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {pairs.map(p => (
                          <div key={p} className="flex items-center justify-between p-2.5 bg-zinc-900/40 rounded-lg border border-white/5 group">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">{p}</span>
                            <button type="button" onClick={() => removePair(p)} className="p-1.5 hover:bg-red-500 rounded-md transition-all">
                              <Trash2 className="h-3.5 w-3.5 text-red-500 group-hover:text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/30 border-white/5 backdrop-blur-md overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-4">
                      <CardTitle className="text-xs md:text-sm font-headline flex items-center gap-2 uppercase">
                        <Clock className="h-4 w-4 text-primary" />
                        Ventanas Operativas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Horarios Autorizados</span>
                        <Button type="button" variant="outline" size="sm" onClick={addSchedule} className="h-6 text-[9px] px-2 border-primary/30 text-primary">
                          + Nueva
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {schedules.map((s, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-900/40 rounded-lg border border-white/5">
                            <Input 
                              type="text" 
                              value={s.start} 
                              onChange={e => {
                                const newScheds = [...schedules];
                                newScheds[idx].start = e.target.value;
                                setSchedules(newScheds);
                                setIsEditing(true);
                              }}
                              className="bg-zinc-900/50 border-white/10 h-7 text-center text-[10px] font-bold px-1" 
                            />
                            <span className="text-[10px] text-muted-foreground">/</span>
                            <Input 
                              type="text" 
                              value={s.end} 
                              onChange={e => {
                                const newScheds = [...schedules];
                                newScheds[idx].end = e.target.value;
                                setSchedules(newScheds);
                                setIsEditing(true);
                              }}
                              className="bg-zinc-900/50 border-white/10 h-7 text-center text-[10px] font-bold px-1" 
                            />
                            <button type="button" onClick={() => setSchedules(schedules.filter((_, i) => i !== idx))} className="text-red-500 p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="fixed md:absolute bottom-4 left-4 right-4 md:bottom-8 md:right-8 md:left-auto z-40">
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full md:w-auto h-14 md:h-16 px-6 md:px-10 rounded-xl md:rounded-2xl bg-primary text-white font-headline text-base md:text-lg font-bold shadow-2xl shadow-primary/30 flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" /> : <ShieldCheck className="h-5 w-5 md:h-6 md:w-6" />}
                  GUARDAR CONFIGURACIÓN MAESTRA
                </Button>
              </div>
            </form>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
