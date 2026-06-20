
'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, ShieldAlert, Target, TrendingUp, AlertTriangle, Save, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateBotConfig } from '@/lib/actions';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function RiskPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  const [investment, setInvestment] = useState('10');
  const [stopLoss, setStopLoss] = useState('50');
  const [takeProfit, setTakeProfit] = useState('100');
  const [maxTrades, setMaxTrades] = useState('20');
  const [martingale, setMartingale] = useState(false);

  useEffect(() => {
    if (botParams) {
      setInvestment(botParams.investmentPerTrade?.toString() || '10');
      setStopLoss(botParams.stopLoss?.toString() || '50');
      setTakeProfit(botParams.takeProfit?.toString() || '100');
      setMaxTrades(botParams.maxTradesPerDay?.toString() || '20');
      setMartingale(!!botParams.martingale);
    }
  }, [botParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const config = {
      investmentPerTrade: parseFloat(investment),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      maxTradesPerDay: parseInt(maxTrades),
      martingale: martingale,
    };

    const result = await updateBotConfig(config);
    setLoading(false);

    if (result.success) {
      toast({
        title: "PROTOCOLOS DE RIESGO ACTUALIZADOS",
        description: "El motor ha sincronizado los nuevos límites de seguridad.",
      });
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Control de Riesgo
          </h1>
        </header>

        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Gestión de Capital</h2>
            <p className="text-muted-foreground italic">Defina los parámetros de seguridad que el Ejército de IA debe respetar estrictamente.</p>
          </div>

          {paramsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-muted-foreground animate-pulse">Sincronizando con el núcleo...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                    Límites de Pérdida
                  </CardTitle>
                  <CardDescription>Evite el "Drawdown" excesivo en su cuenta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stopLoss">Stop Loss Diario ($)</Label>
                    <Input 
                      id="stopLoss" 
                      type="number" 
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="bg-background/50 border-white/5 h-12" 
                    />
                    <p className="text-[10px] text-muted-foreground font-bold italic uppercase tracking-widest">Apagado automático al alcanzar este límite.</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold">Protección de Balance</Label>
                      <p className="text-[10px] text-muted-foreground">Cierre forzado en volatilidad extrema</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Objetivos de Beneficio
                  </CardTitle>
                  <CardDescription>Asegure sus ganancias diarias.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="takeProfit">Take Profit Diario ($)</Label>
                    <Input 
                      id="takeProfit" 
                      type="number" 
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      className="bg-background/50 border-white/5 h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxTrades">Máximo de Operaciones / Día</Label>
                    <Input 
                      id="maxTrades" 
                      type="number" 
                      value={maxTrades}
                      onChange={(e) => setMaxTrades(e.target.value)}
                      className="bg-background/50 border-white/5 h-12" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5 backdrop-blur-xl md:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <TrendingUp className="h-40 w-40 text-primary" />
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Configuración de Apalancamiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="investment" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Monto por Operación ($)</Label>
                    <Input 
                      id="investment" 
                      type="number" 
                      step="0.1" 
                      value={investment}
                      onChange={(e) => setInvestment(e.target.value)}
                      className="bg-background/50 border-white/5 h-14 text-xl font-code font-bold text-primary" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-5 bg-red-500/5 border border-red-500/20 rounded-2xl group hover:bg-red-500/10 transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="martingale" className="text-red-500 font-bold text-lg">Estrategia Martingala</Label>
                      <p className="text-[10px] text-red-500/70 italic leading-tight uppercase font-bold tracking-tighter">
                        Duplica el monto tras una pérdida. <br />Nivel de riesgo: CRÍTICO.
                      </p>
                    </div>
                    <Switch 
                      id="martingale" 
                      checked={martingale}
                      onCheckedChange={setMartingale}
                      className="data-[state=checked]:bg-red-500"
                    />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-8 flex justify-between items-center bg-white/5 p-8 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estado Sincronización</span>
                    <span className="text-xs font-code text-primary">EN LÍNEA / MOTOR V3</span>
                  </div>
                  <Button type="submit" className="gap-2 px-12 h-14 font-headline text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    VIGILAR Y GUARDAR PARÁMETROS
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          <div className="p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex gap-5 items-start">
            <div className="p-3 bg-yellow-500/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-yellow-500 text-md uppercase tracking-wide">Advertencia de Ejecución Autónoma</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                El Ejército de IA operará de forma 100% autónoma basándose en estos límites. Asegúrese de que su Stop Loss sea coherente con su balance en IQ Option. Las decisiones tomadas por el motor cuántico son irreversibles una vez enviadas al puente.
              </p>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
