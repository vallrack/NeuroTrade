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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Settings2, Save, Cpu, Loader2, RefreshCw, Zap, Clock, ShieldAlert, 
  TrendingUp, Target, Plus, Trash2, Sliders, Globe, Activity, ChevronDown 
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

  // Estados del formulario inicializados con los valores V7 de la imagen
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

    if (user && brokerRef) {
      setDoc(brokerRef, { email, password }, { merge: true });
    }

    const result = await updateBotConfig(config);
    setLoading(false);
    setIsEditing(false);

    if (result.success) {
      toast({
        title: "NÚCLEO V7 ACTUALIZADO",
        description: "Valores sincronizados con la captura maestra.",
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
    setSchedules([...schedules, {start: '07:00', end: '09:00'}]);
    setIsEditing(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            CONFIGURACIÓN V7
          </h1>
        </header>
        
        <main className="p-6 max-w-lg mx-auto space-y-4">
          {paramsLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <RefreshCw className="h-8 w-8 text-primary animate-spin" />
               <p className="text-sm font-bold text-muted-foreground">Sincronizando núcleo v7...</p>
             </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              
              <Card className="bg-card/40 border-white/5 overflow-hidden">
                <div className="bg-primary px-4 py-2 flex items-center justify-between text-white text-xs font-bold">
                  <span>IQ Option</span>
                  <ChevronDown className="h-4 w-4" />
                </div>
                <CardContent className="p-4 space-y-3">
                  <Input 
                    placeholder="email@dominio.com" 
                    value={email} 
                    onChange={e => {setEmail(e.target.value); setIsEditing(true);}} 
                    className="bg-zinc-800/50 border-white/10 h-10"
                  />
                  <Input 
                    type="password" 
                    placeholder="**********" 
                    value={password} 
                    onChange={e => {setPassword(e.target.value); setIsEditing(true);}} 
                    className="bg-zinc-800/50 border-white/10 h-10"
                  />
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Meta (Take Profit)</Label>
                      <Input 
                        type="number" 
                        value={takeProfit} 
                        onChange={e => {setTakeProfit(e.target.value); setIsEditing(true);}} 
                        className="bg-zinc-800/50 border-white/10 h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Límite (Stop Loss)</Label>
                      <Input 
                        type="number" 
                        value={stopLoss} 
                        onChange={e => {setStopLoss(e.target.value); setIsEditing(true);}} 
                        className="bg-zinc-800/50 border-white/10 h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Saldo Mínimo</Label>
                      <Input 
                        type="number" 
                        value={minBalance} 
                        onChange={e => {setMinBalance(e.target.value); setIsEditing(true);}} 
                        className="bg-zinc-800/50 border-white/10 h-10"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Inversión por Trade</Label>
                    <Input 
                      type="number" 
                      value={investment} 
                      onChange={e => {setInvestment(e.target.value); setIsEditing(true);}} 
                      className="bg-zinc-800/50 border-white/10 h-10 text-primary font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Máx. Operaciones Día</Label>
                    <Input 
                      type="number" 
                      value={maxTrades} 
                      onChange={e => {setMaxTrades(e.target.value); setIsEditing(true);}} 
                      className="bg-zinc-800/50 border-white/10 h-10"
                    />
                  </div>

                  <div className="relative pt-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Añadir Activos</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Activo (Ej: BTCUSD)" 
                        value={newPair} 
                        onChange={e => setNewPair(e.target.value)}
                        className="bg-zinc-800/50 border-white/10 h-10 flex-1"
                      />
                      <Button 
                        type="button" 
                        onClick={addPair} 
                        size="icon" 
                        className="h-10 w-10 bg-primary"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    {pairs.map(p => (
                      <div key={p} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded border border-white/5">
                        <div className="flex items-center gap-2">
                          <Checkbox checked />
                          <span className="text-[11px] font-bold uppercase">{p}</span>
                        </div>
                        <button type="button" onClick={() => removePair(p)} className="bg-red-500 p-1 rounded">
                          <Trash2 className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 pt-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Máx. Pérdidas Seguidas</Label>
                    <Input 
                      type="number" 
                      value={maxLosses} 
                      onChange={e => {setMaxLosses(e.target.value); setIsEditing(true);}} 
                      className="bg-zinc-800/50 border-white/10 h-10"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-muted-foreground">RSI Min</Label>
                      <Input type="number" value={minRsi} onChange={e => {setMinRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-800/50 border-white/10 h-8 text-center" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-muted-foreground">RSI Mid</Label>
                      <Input type="number" value={midRsi} onChange={e => {setMidRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-800/50 border-white/10 h-8 text-center" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-muted-foreground">RSI Max</Label>
                      <Input type="number" value={maxRsi} onChange={e => {setMaxRsi(e.target.value); setIsEditing(true);}} className="bg-zinc-800/50 border-white/10 h-8 text-center" />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Clock className="h-4 w-4 text-primary" /> Horarios
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addSchedule} className="bg-primary text-white h-7 text-[10px] px-3">
                        + Añadir
                      </Button>
                    </div>
                    {schedules.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white/5 p-2 rounded border border-white/5">
                        <Input 
                          type="text" 
                          value={s.start.substring(0, 2)} 
                          onChange={e => {
                            const n = [...schedules];
                            n[idx].start = `${e.target.value.padStart(2, '0')}:00`;
                            setSchedules(n);
                            setIsEditing(true);
                          }}
                          className="bg-zinc-800/50 border-white/10 h-8 w-14 text-center text-xs" 
                        />
                        <span className="text-xs text-muted-foreground">a</span>
                        <Input 
                          type="text" 
                          value={s.end.substring(0, 2)} 
                          onChange={e => {
                            const n = [...schedules];
                            n[idx].end = `${e.target.value.padStart(2, '0')}:00`;
                            setSchedules(n);
                            setIsEditing(true);
                          }}
                          className="bg-zinc-800/50 border-white/10 h-8 w-14 text-center text-xs" 
                        />
                        <button type="button" onClick={() => {
                          const n = schedules.filter((_, i) => i !== idx);
                          setSchedules(n);
                          setIsEditing(true);
                        }} className="bg-red-500 p-1.5 rounded ml-auto">
                          <Trash2 className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" disabled={loading} className="w-full bg-primary h-12 font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                SINCRONIZAR VALORES V7
              </Button>
            </form>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
