
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BookOpen, Brain, TrendingUp, ShieldCheck, Zap, Info, Target, 
  Layers, Sliders, Cpu, Activity, Globe, Gauge, Calculator, MousePointer2, AlertTriangle
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function ManualPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2 uppercase tracking-tight">
            <BookOpen className="h-5 w-5 text-primary" />
            MANUAL DE OPERACIÓN V7 - NÚCLEO MAESTRO
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-10 pb-20">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Arquitectura de Decisión IA</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              El motor **NeuroTrade V7** opera bajo un protocolo de consenso distribuido. Cinco agentes de IA de grado militar analizan simultáneamente el feed de datos en tiempo real antes de emitir una señal.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Target className="h-5 w-5" />
                    Protocolo de Consenso V7
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                  <p>Para garantizar la máxima precisión, el bot aplica las siguientes reglas:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Ejecución (80%+):</strong> Requiere que al menos 4 de los 5 agentes coincidan en la dirección (CALL o PUT).</li>
                    <li><strong>Vigilancia (60-79%):</strong> El bot entra en modo de espera, analizando el siguiente bloque de datos.</li>
                    <li><strong>Filtro de Ruido:</strong> La IA bloquea la operativa si detecta una anomalía de volumen o volatilidad extrema.</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                    <Calculator className="h-5 w-5" />
                    Fórmulas de Rendimiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5 font-code text-primary shadow-inner">
                    <p className="text-[10px] mb-1 opacity-50 uppercase font-bold">Ganancia Neta por Trade:</p>
                    Profit = (Inversión × Payout%) - Pérdida
                  </div>
                  <p className="italic text-[11px] leading-relaxed">
                    Con una inversión maestra de **$4,000** y un payout del 85%, el beneficio neto es de **$3,400**. El sistema busca alcanzar el **Take Profit de $60,000** mediante una progresión controlada.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Gauge className="h-6 w-6 text-secondary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Umbrales de RSI Cuántico</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm">
              La calibración V7 utiliza tres niveles críticos de RSI para identificar reversiones de alta probabilidad en velas de 1 minuto:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center shadow-lg hover:border-primary/30 transition-all">
                <div className="text-4xl font-black text-primary mb-2">20</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MIN (Sobreventa)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">Nivel de agotamiento bajista. La IA busca una entrada en **CALL** (Compra).</p>
              </div>
              <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl text-center shadow-xl">
                <div className="text-4xl font-black text-secondary mb-2">38</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MED (Control)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">Punto de equilibrio dinámico. Valida la fuerza de la tendencia actual.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center shadow-lg hover:border-red-500/30 transition-all">
                <div className="text-4xl font-black text-red-500 mb-2">62</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MAX (Sobrecompra)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">Nivel de agotamiento alcista. La IA busca una entrada en **PUT** (Venta).</p>
              </div>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Protocolos de Seguridad V7</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card/50 border border-white/5 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-primary" /> Proceso de Operación</h4>
                <ol className="text-sm text-muted-foreground space-y-4 list-decimal pl-4">
                  <li><strong>Sincronización:</strong> Verifique que el puente con IQ Option esté en estado 'Conectado'.</li>
                  <li><strong>Límites:</strong> Configure el **Stop Loss ($8,000)** para proteger su capital principal.</li>
                  <li><strong>Clústers:</strong> Seleccione pares OTC si opera en fines de semana o FX real en días laborales.</li>
                  <li><strong>Activación:</strong> Inicie el motor y monitoree el consenso en el Dashboard.</li>
                </ol>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-yellow-500"><AlertTriangle className="h-4 w-4" /> Gestión de Riesgo</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si el bot detecta **2 pérdidas consecutivas**, el protocolo de seguridad V7 suspende la ejecución durante 15 minutos para evitar rachas de volatilidad en el bróker.
                </p>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 items-center">
                  <Activity className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-500/90 font-bold uppercase tracking-tight">Latencia de ejecución: < 8 microsegundos.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
