
'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { updateBotConfig } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Sliders, Save, ShieldAlert, Cpu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();

  async function handleSubmit(formData: FormData) {
    const result = await updateBotConfig(formData);
    if (result.success) {
      toast({
        title: "Configuración Actualizada",
        description: "Los parámetros del motor han sido guardados correctamente.",
      });
    } else {
      toast({
        title: "Error de Guardado",
        description: "No se pudieron actualizar los parámetros.",
        variant: "destructive",
      });
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold">Configuración del Motor</h1>
        </header>
        
        <main className="p-6 max-w-4xl mx-auto space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sliders className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-headline font-bold">Parámetros Operativos</h2>
                <p className="text-sm text-muted-foreground">Ajuste sus algoritmos en tiempo real. Los cambios se aplican en &lt;100ms.</p>
              </div>
            </div>

            <form action={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Gestión de Riesgo</CardTitle>
                  <CardDescription>Defina su exposición y límites de protección.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="investment">Inversión por Operación ($)</Label>
                    <Input id="investment" name="investment" type="number" step="0.01" defaultValue="10.00" className="bg-background border-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stopLoss">Límite de Pérdida Diaria ($)</Label>
                    <Input id="stopLoss" name="stopLoss" type="number" step="0.01" defaultValue="50.00" className="bg-background border-white/5" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="martingale">Estrategia Martingala</Label>
                      <p className="text-[10px] text-muted-foreground italic">Duplicar en pérdida (ALTO RIESGO)</p>
                    </div>
                    <Switch id="martingale" name="martingale" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Activos Objetivo</CardTitle>
                  <CardDescription>Seleccione los clústeres para que la IA los procese.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="pairs">Pares de Divisas Activos (Sep. por comas)</Label>
                    <Input id="pairs" name="pairs" defaultValue="EUR/USD, GBP/JPY, BTC/USD" className="bg-background border-white/5" />
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-xs text-secondary font-bold">
                      <Cpu className="h-4 w-4" />
                      ESTADO DEL ALGO: OPTIMIZADO
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Latencia actual a servidores NY: 12ms.
                      Umbral de confianza del Ejército de IA: 78%.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="md:col-span-2 flex justify-end gap-4">
                <Button variant="ghost">Restaurar Fábrica</Button>
                <Button type="submit" className="gap-2 px-8">
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </section>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="flex flex-row items-center gap-4">
              <ShieldAlert className="h-8 w-8 text-red-500" />
              <div>
                <CardTitle className="text-red-500">Sobrescritura de Pánico Maestra</CardTitle>
                <CardDescription className="text-red-500/70">Active esto para congelar permanentemente todas las actividades hasta reactivación manual.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="w-full">ACTIVAR PROTOCOLO CERO</Button>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
