
'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { updateBotConfig } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings2, Save, Cpu, Loader2, RefreshCw, Zap, Clock, ShieldAlert, 
  TrendingUp, Target, Plus, Trash2, Sliders, Globe, Activity 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function SettingsV7Page() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  const [isEditing, setIsEditing] = useState(false);
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  // Estados del formulario V7
  const [botActive, setBotActive] = useState(true);
  const [investment, setInvestment] = useState('10');
  const [stopLoss, setStopLoss] = useState('50');
  const [takeProfit, setTakeProfit] = useState('100');
  const [maxLosses, setMaxLosses] = useState('3');
  const [minRsi, setMinRsi] = useState('30');
  const [maxRsi, setMaxRsi] = useState('70');
  const [martingale, setMartingale] = useState(false);
  const [pairs, setPairs] = useState<string[]>(['EUR/USD']);
  const [newPair, setNewPair] = useState('');
  const [schedules, setSchedules] = useState<{start: string, end: string}[]>([]);

  useEffect(() => {
    if (botParams && !isEditing) {
      setBotActive(botParams.bot_activo !== undefined ? botParams.bot_activo : true);
      setInvestment(botParams.investmentPerTrade?.toString() || '10');
      setStopLoss(botParams.stopLoss?.toString() || '50');
      setTakeProfit(botParams.takeProfit?.toString() || '100');
      setMaxLosses(botParams.maxLosses?.toString() || '3');
      setMinRsi(botParams.minRsi?.toString() || '30');
      setMaxRsi(botParams.maxRsi?.toString() || '70');
      setMartingale(!!botParams.martingale);
      setPairs(botParams.pairs || ['EUR/USD']);
      setSchedules(botParams.schedules || [{start: '09:00', end: '18:00'}]);
    }
  }, [botParams, isEditing]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const config = {
      bot_activo: botActive,
      investmentPerTrade: parseFloat(investment),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      maxLosses: parseInt(maxLosses),
      minRsi: parseFloat(minRsi),
      maxRsi: parseFloat(maxRsi),
      martingale,
      pairs,
      schedules
    };

    const result = await updateBotConfig(config);
    setLoading(false);
    setIsEditing(false);

    if (result.success) {
      toast({
        title: "NÚCLEO V7 ACTUALIZADO",
        description: "Todos los parámetros operativos han sido sincronizados con el Ejército de IA.",
      });
    }
  }

  const addPair = () => {
    if (newPair && !pairs.includes(newPair.toUpperCase())) {
      setPairs([...pairs, newPair.toUpperCase()]);
      setNewPair('');
      setIsEditing(true);
    }
  };

  const removePair = (p: string) => {
    setPairs(pairs.filter(pair => pair !== p));
    setIsEditing(true);
  };

  const addSchedule = () => {
    setSchedules([...schedules, {start: '00:00', end: '23:59'}]);
    setIsEditing(true);
  };

  const removeSchedule = (idx: number) => {
    setSchedules(schedules.filter((_, i) => i !== idx));
    setIsEditing(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Configuración Maestra V7
          </h1>
        </header>
        
        <main className="p-6 max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-headline font-bold">Protocolo Operativo Quantum</h2>
                <p className="text-sm text-muted-foreground">Gestión total de riesgos, parámetros técnicos y horarios de ejecución.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-full border border-white/5">
              <span className={`w-2 h-2 rounded-full ${botActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{botActive ? 'Núcleo Online' : 'Núcleo Standby'}</span>
              <Switch checked={botActive} onCheckedChange={(val) => { setBotActive(val); setIsEditing(true); }} />
            </div>
          </div>

          {paramsLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <RefreshCw className="h-8 w-8 text-primary animate-spin" />
               <p className="text-sm font-bold text-muted-foreground animate-pulse">Sincronizando algoritmos v7...</p>
             </div>
          ) : (
            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PANEL 1: GESTIÓN DE CAPITAL Y RIESGO */}
              <div className="space-y-6 lg:col-span-2">
                <Card className="bg-card/30 border-white/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Gestión de Capital
                    </CardTitle>
                    <CardDescription>Defina el comportamiento financiero del bot.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Inversión por Trade ($)</Label>
                      <Input type="number" value={investment} onChange={e => {setInvestment(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12 text-lg font-code" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Límite de Pérdidas Consecutivas</Label>
                      <Input type="number" value={maxLosses} onChange={e => {setMaxLosses(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Stop Loss Diario ($)</Label>
                      <Input type="number" value={stopLoss} onChange={e => {setStopLoss(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">Take Profit Diario ($)</Label>
                      <Input type="number" value={takeProfit} onChange={e => {setTakeProfit(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12 text-green-500" />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/5 border-t border-white/5 p-4 flex justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={martingale} onCheckedChange={v => {setMartingale(v); setIsEditing(true);}} />
                      <Label className="text-[10px] font-bold uppercase tracking-widest">Estrategia Martingala (Alto Riesgo)</Label>
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/20">PROTECCIÓN ACTIVA</Badge>
                  </CardFooter>
                </Card>

                {/* PANEL 2: PARÁMETROS TÉCNICOS (RSI) */}
                <Card className="bg-card/30 border-white/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                      Filtros de Análisis Técnico
                    </CardTitle>
                    <CardDescription>Umbrales de RSI para determinar puntos de entrada.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">RSI Sobreventa (Mínimo)</Label>
                      <Input type="number" value={minRsi} onChange={e => {setMinRsi(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground font-bold">RSI Sobrecompra (Máximo)</Label>
                      <Input type="number" value={maxRsi} onChange={e => {setMaxRsi(e.target.value); setIsEditing(true);}} className="bg-background/50 h-12" />
                    </div>
                  </CardContent>
                </Card>

                {/* PANEL 3: PROGRAMACIÓN DE HORARIOS */}
                <Card className="bg-card/30 border-white/5 backdrop-blur-xl">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                      <Clock className="h-5 w-5 text-accent" />
                      Horarios Operativos
                    </CardTitle>
                    <CardDescription>El bot solo operará dentro de estas ventanas de tiempo.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {schedules.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-background/50 p-4 rounded-xl border border-white/5">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold text-muted-foreground">Inicio</Label>
                            <Input 
                              type="time" 
                              value={s.start} 
                              onChange={e => {
                                const newS = [...schedules];
                                newS[idx].start = e.target.value;
                                setSchedules(newS);
                                setIsEditing(true);
                              }}
                              className="bg-transparent border-white/10"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold text-muted-foreground">Cierre</Label>
                            <Input 
                              type="time" 
                              value={s.end} 
                              onChange={e => {
                                const newS = [...schedules];
                                newS[idx].end = e.target.value;
                                setSchedules(newS);
                                setIsEditing(true);
                              }}
                              className="bg-transparent border-white/10"
                            />
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeSchedule(idx)} className="text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addSchedule} className="w-full border-dashed border-white/10 hover:bg-white/5 gap-2">
                      <Plus className="h-4 w-4" /> AÑADIR VENTANA HORARIA
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* PANEL LATERAL: ACTIVOS Y SEGURO */}
              <div className="space-y-6">
                <Card className="bg-card/30 border-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      Activos Disponibles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="EJ: EUR/USD" 
                        value={newPair} 
                        onChange={e => setNewPair(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addPair())}
                        className="bg-background/50 h-10 uppercase" 
                      />
                      <Button type="button" onClick={addPair} size="icon" className="shrink-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {pairs.map(p => (
                        <Badge key={p} className="bg-primary/20 text-primary border-primary/50 py-1.5 pl-3 pr-2 gap-2 text-xs font-bold uppercase">
                          {p}
                          <button type="button" onClick={() => removePair(p)} className="hover:text-red-500 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-red-500/5 border-red-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <ShieldAlert className="h-24 w-24 text-red-500" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2 text-red-500">
                      <ShieldAlert className="h-4 w-4" />
                      Protocolo de Emergencia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-[10px] text-red-500/70 italic leading-relaxed">
                      Si el balance cae por debajo del 20% del monto inicial, el bot se congelará físicamente.
                    </p>
                    <Button variant="destructive" className="w-full h-12 font-headline text-xs gap-2 shadow-xl shadow-red-900/20">
                      BORRAR TODO Y ABORTAR
                    </Button>
                  </CardContent>
                </Card>

                <div className="pt-4">
                  <Button type="submit" className="w-full h-16 font-headline text-lg gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                    GUARDAR CONFIGURACIÓN V7
                  </Button>
                  <p className="text-center text-[9px] text-muted-foreground mt-4 uppercase tracking-[0.2em] font-bold">
                    Sincronización Cuántica Segura (SSL v3)
                  </p>
                </div>
              </div>

            </form>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
