
'use client';

import { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, ShieldAlert, Target, TrendingUp, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateBotConfig } from '@/lib/actions';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function RiskPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams } = useDoc(botParamsRef);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const config = {
      investmentPerTrade: parseFloat(formData.get('investment') as string),
      stopLoss: parseFloat(formData.get('stopLoss') as string),
      takeProfit: parseFloat(formData.get('takeProfit') as string),
      maxTradesPerDay: parseInt(formData.get('maxTrades') as string),
      martingale: formData.get('martingale') === 'on',
      pairs: botParams?.pairs || ['EUR/USD'],
    };

    const result = await updateBotConfig(config);
    setLoading(false);

    if (result.success) {
      toast({
        title: "PROTOCOLOS DE RIESGO ACTUALIZADOS",
        description: "El centinela ha registrado los nuevos límites de seguridad.",
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
            <h2 className="text-3xl font-headline font-bold">Gestión de Capital</h2>
            <p className="text-muted-foreground italic">Defina los parámetros de seguridad que el Ejército de IA debe respetar estrictamente.</p>
          </div>

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
                    name="stopLoss" 
                    type="number" 
                    defaultValue={botParams?.stopLoss || 50} 
                    className="bg-background/50 border-white/5" 
                  />
                  <p className="text-[10px] text-muted-foreground">Si las pérdidas del día alcanzan este monto, el bot se detendrá automáticamente.</p>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Protección de Balance</Label>
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
                    name="takeProfit" 
                    type="number" 
                    defaultValue={botParams?.takeProfit || 100} 
                    className="bg-background/50 border-white/5" 
                  />
                  <p className="text-[10px] text-muted-foreground">Al alcanzar esta meta, el bot entrará en reposo hasta el día siguiente.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTrades">Máximo de Operaciones / Día</Label>
                  <Input 
                    id="maxTrades" 
                    name="maxTrades" 
                    type="number" 
                    defaultValue={botParams?.maxTradesPerDay || 20} 
                    className="bg-background/50 border-white/5" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-white/5 backdrop-blur-xl md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Configuración de Apalancamiento
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="investment">Inversión por Operación ($)</Label>
                  <Input 
                    id="investment" 
                    name="investment" 
                    type="number" 
                    step="0.01" 
                    defaultValue={botParams?.investmentPerTrade || 10} 
                    className="bg-background/50 border-white/5" 
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                  <div className="space-y-1">
                    <Label htmlFor="martingale" className="text-red-500 font-bold">Estrategia Martingala</Label>
                    <p className="text-[10px] text-red-500/70 italic leading-tight">Duplica el monto tras una pérdida. Nivel de riesgo: CRÍTICO.</p>
                  </div>
                  <Switch id="martingale" name="martingale" defaultChecked={botParams?.martingale} />
                </div>
              </CardContent>
              <CardFooter className="border-t border-white/5 pt-6 flex justify-end">
                <Button type="submit" className="gap-2 px-10 h-12 font-headline shadow-xl shadow-primary/20" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  GUARDAR PARÁMETROS DE SEGURIDAD
                </Button>
              </CardFooter>
            </Card>
          </form>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-4 items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-1" />
            <div className="space-y-1">
              <h4 className="font-bold text-yellow-500 text-sm">Advertencia de Ejecución Automática</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                El Ejército de IA operará de forma autónoma basándose en estos límites. Asegúrese de que su Stop Loss sea coherente con su balance en IQ Option para evitar liquidaciones inesperadas.
              </p>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
