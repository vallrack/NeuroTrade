
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
        <header className="flex h-16 shrink-0 items-center px-4 md:px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-lg md:text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Control de Riesgo
          </h1>
        </header>

        <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 md:space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl md:text-3xl font-headline font-bold text-foreground tracking-tight">Gestión de Capital</h2>
            <p className="text-sm md:text-base text-muted-foreground italic">Defina los parámetros de seguridad operativa.</p>
          </div>

          {paramsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-muted-foreground animate-pulse">Sincronizando...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 md:pb-0">
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                    Límites Pérdida
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stopLoss" className="text-xs uppercase font-bold text-muted-foreground">Stop Loss Diario ($)</Label>
                    <Input 
                      id="stopLoss" 
                      type="number" 
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      className="bg-background/50 border-white/5 h-11 md:h-12" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] md:text-xs font-bold">Protección Balance</Label>
                      <p className="text-[8px] md:text-[10px] text-muted-foreground">Cierre en volatilidad</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Target className="h-5 w-5 text-green-500" />
                    Objetivos Meta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="takeProfit" className="text-xs uppercase font-bold text-muted-foreground">Take Profit Diario ($)</Label>
                    <Input 
                      id="takeProfit" 
                      type="number" 
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      className="bg-background/50 border-white/5 h-11 md:h-12" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxTrades" className="text-xs uppercase font-bold text-muted-foreground">Máx Operaciones / Día</Label>
                    <Input 
                      id="maxTrades" 
                      type="number" 
                      value={maxTrades}
                      onChange={(e) => setMaxTrades(e.target.value)}
                      className="bg-background/50 border-white/5 h-11 md:h-12" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5 backdrop-blur-xl md:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none hidden md:block">
                  <TrendingUp className="h-40 w-40 text-primary" />
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Apalancamiento V7
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="investment" className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto por Operación ($)</Label>
                    <Input 
                      id="investment" 
                      type="number" 
                      step="0.1" 
                      value={investment}
                      onChange={(e) => setInvestment(e.target.value)}
                      className="bg-background/50 border-white/5 h-12 md:h-14 text-xl md:text-2xl font-code font-bold text-primary text-center" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 md:p-5 bg-red-500/5 border border-red-500/20 rounded-xl md:rounded-2xl group transition-colors">
                    <div className="space-y-1">
                      <Label htmlFor="martingale" className="text-red-500 font-bold text-base md:text-lg">Estrategia Martingala</Label>
                      <p className="text-[8px] md:text-[10px] text-red-500/70 italic leading-tight uppercase font-bold">
                        Riesgo Crítico de Drawdown.
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
                <CardFooter className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 md:p-8 gap-4">
                  <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sincronización HFT</span>
                    <span className="text-xs font-code text-primary">MOTOR V7 ACTIVO</span>
                  </div>
                  <Button type="submit" className="w-full md:w-auto gap-2 px-8 md:px-12 h-12 md:h-14 font-headline text-base md:text-lg shadow-xl shadow-primary/20" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    GUARDAR CAMBIOS
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          <div className="p-4 md:p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl md:rounded-2xl flex flex-col sm:flex-row gap-4 md:gap-5 items-start">
            <div className="p-2 md:p-3 bg-yellow-500/20 rounded-full shrink-0">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-yellow-500" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-yellow-500 text-sm md:text-md uppercase tracking-wide">Advertencia de Autonomía</h4>
              <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                El sistema operará de forma autónoma basándose en estos límites. Las decisiones tomadas por el núcleo V7 son irreversibles.
              </p>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
