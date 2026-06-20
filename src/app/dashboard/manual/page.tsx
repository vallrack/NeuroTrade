
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BookOpen, Brain, TrendingUp, ShieldCheck, Zap, Info, Target, 
  Layers, Sliders, Cpu, Activity, Globe, Scale, Gauge
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function ManualPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Manual de Operación V7
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-10 pb-20">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Arquitectura de Decisión</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              El sistema NeuroTrade V7 utiliza un **Comité de Inteligencia Colectiva** compuesto por 5 agentes expertos que analizan el mercado de forma simultánea. Las decisiones no se basan en un solo indicador, sino en la convergencia de datos técnicos y análisis probabilístico.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm font-headline flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Consenso Maestro
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  La IA solo ejecutará un trade si al menos **4 de los 5 agentes** están de acuerdo (>80% de confianza).
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm font-headline flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    Análisis de Velas
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Se analizan las últimas 5 velas de 1 minuto (OHLC) para determinar la fuerza de la tendencia.
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm font-headline flex items-center gap-2">
                    <Scale className="h-4 w-4 text-secondary" />
                    Probabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Cada decisión tiene un puntaje de confianza. Solo se opera con señales de "Alta Probabilidad".
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Gauge className="h-6 w-6 text-secondary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Umbrales de RSI Cuántico</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              El RSI (Relative Strength Index) es el filtro principal de nuestra IA. En la Versión 7, utilizamos tres umbrales específicos:
            </p>
            <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0">20</div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Umbral Mínimo (Sobreventa Extrema)</h4>
                  <p className="text-sm text-muted-foreground">Punto donde el precio ha caído demasiado rápido. La IA busca confirmación para un posible **CALL** (Compra).</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-secondary shrink-0">38</div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Umbral Medio (Equilibrio de Tendencia)</h4>
                  <p className="text-sm text-muted-foreground">Zona de control de volatilidad. La IA valida si la tendencia tiene fuerza suficiente para continuar.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center font-bold text-red-500 shrink-0">62</div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white">Umbral Máximo (Sobrecompra Controlada)</h4>
                  <p className="text-sm text-muted-foreground">Límite de seguridad para evitar compras en picos de agotamiento. Posible señal de **PUT** (Venta).</p>
                </div>
              </div>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Gestión de Riesgo y Fórmulas</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Cálculo de Beneficios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-background/50 rounded-lg font-code text-primary">
                    Profit = Inversión * Payout (%)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: Una inversión de $4,000 con un payout del 85% genera un retorno de $3,400 netos. El sistema actualiza su saldo automáticamente tras el cierre de 1 minuto.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Protocolo de Seguridad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  <p>• **Stop Loss:** Si el total de pérdidas del día alcanza este valor, el bot activa el "Kill Switch" y detiene todas las operaciones.</p>
                  <p>• **Pérdidas Permitidas:** Si el sistema detecta N pérdidas consecutivas, asume que el mercado está errático y entra en modo Standby.</p>
                  <p>• **Minimo:** Salvaguarda de capital. El bot nunca operará si su saldo cae por debajo de este monto.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="p-8 bg-primary/10 border border-primary/20 rounded-3xl flex flex-col md:flex-row gap-6 items-center">
             <div className="p-4 bg-primary/20 rounded-2xl">
               <Zap className="h-10 w-10 text-primary" />
             </div>
             <div className="space-y-2 text-center md:text-left">
               <h3 className="text-xl font-headline font-bold text-primary">Listo para operar</h3>
               <p className="text-sm text-muted-foreground">
                 Asegúrese de configurar sus credenciales de IQ Option y seleccionar sus clústeres de activos antes de activar el motor. La Versión 7 está diseñada para operar con precisión quirúrgica en temporalidades de 1 minuto.
               </p>
             </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
