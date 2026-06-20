
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
import { Sliders, Save, ShieldAlert, Cpu, Loader2, RefreshCw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  
  const botParamsRef = doc(firestore, 'configuracion', 'bot_params');
  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  const [pairs, setPairs] = useState('EUR/USD, BTC/USD');
  const [botActive, setBotActive] = useState(true);

  useEffect(() => {
    if (botParams) {
      setPairs(botParams.pairs?.join(', ') || 'EUR/USD');
      setBotActive(!!botParams.bot_activo);
    }
  }, [botParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    const config = {
      pairs: pairs.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== ''),
      bot_activo: botActive
    };

    const result = await updateBotConfig(config);
    setLoading(false);

    if (result.success) {
      toast({
        title: "NÚCLEO ACTUALIZADO",
        description: "El motor ha sido reconfigurado exitosamente.",
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
            <Sliders className="h-5 w-5 text-primary" />
            Configuración del Motor
          </h1>
        </header>
        
        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-headline font-bold">Parámetros Operativos V4</h2>
              <p className="text-sm text-muted-foreground">Ajuste los clústeres de datos y la latencia del núcleo. Cambios en tiempo real.</p>
            </div>
          </div>

          {paramsLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <RefreshCw className="h-8 w-8 text-primary animate-spin" />
               <p className="text-sm font-bold text-muted-foreground animate-pulse">Consultando algoritmos...</p>
             </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Estado del Sistema</CardTitle>
                    <CardDescription>Habilite o congele la actividad del motor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <Label className="text-md font-bold">Botón de Inicio Maestro</Label>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                          {botActive ? 'MOTOR EN EJECUCIÓN' : 'MOTOR EN REPOSO'}
                        </p>
                      </div>
                      <Switch 
                        checked={botActive}
                        onCheckedChange={setBotActive}
                        className="scale-125"
                      />
                    </div>
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                       <div className="flex items-center gap-3 text-xs font-bold text-primary mb-2">
                         <Cpu className="h-4 w-4" />
                         ESTADO: ÓPTIMO
                       </div>
                       <p className="text-[10px] text-muted-foreground italic leading-tight">
                         La latencia de ejecución actual es de 12ms. El umbral de confianza del consenso está calibrado al 75% para evitar ráfagas falsas.
                       </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Clústeres de Divisas</CardTitle>
                    <CardDescription>Seleccione los activos para que la IA los procese.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pairs">Activos Objetivo (Separados por comas)</Label>
                      <Input 
                        id="pairs" 
                        value={pairs}
                        onChange={(e) => setPairs(e.target.value)}
                        placeholder="EUR/USD, BTC/USD, GBP/JPY" 
                        className="bg-background/50 border-white/5 h-12 font-code" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-4">
                       <Badge variant="outline" className="justify-center py-1">EUR/USD 12ms</Badge>
                       <Badge variant="outline" className="justify-center py-1">BTC/USD 15ms</Badge>
                       <Badge variant="outline" className="justify-center py-1">GBP/JPY 18ms</Badge>
                       <Badge variant="outline" className="justify-center py-1">ETH/USD 14ms</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="gap-2 px-10 h-14 font-headline text-lg shadow-xl shadow-primary/20" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  GUARDAR CONFIGURACIÓN DEL NÚCLEO
                </Button>
              </div>
            </form>
          )}

          <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <ShieldAlert className="h-32 w-32 text-red-500" />
            </div>
            <CardHeader className="flex flex-row items-center gap-5">
              <div className="p-3 bg-red-500/20 rounded-2xl">
                <ShieldAlert className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-red-500 font-headline text-xl">Sobrescritura de Pánico Maestra</CardTitle>
                <CardDescription className="text-red-500/70">Activar el Protocolo Cero congelará todas las actividades y borrará la memoria caché operativa.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="w-full h-14 font-headline text-lg hover:scale-[1.01] transition-transform shadow-xl shadow-red-900/20">
                ACTIVAR PROTOCOLO CERO (ABORTO)
              </Button>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
