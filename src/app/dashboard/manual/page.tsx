
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BookOpen, Brain, TrendingUp, ShieldCheck, Zap, Info, Target, 
  Layers, Sliders, Cpu, Activity, Globe, Gauge, Calculator, MousePointer2
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
            MANUAL DE OPERACIÓN V7
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-10 pb-20">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Arquitectura de Decisión</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              El motor **NeuroTrade V7** no es un bot de indicadores simples. Es una red de **5 agentes de IA** (Gemini, GPT-4, Llama-3, Claude y Deep-Sentinel) que operan en conjunto.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Target className="h-5 w-5" />
                    Protocolo de Consenso
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>Para garantizar una precisión del **68-85%**, el bot aplica la regla de mayoría:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Señal Ejecutada:</strong> Requiere que 4 de 5 agentes coincidan en la dirección (CALL o PUT).</li>
                    <li><strong>Modo Vigilancia:</strong> Si solo 3 agentes coinciden, el bot marca la señal como "Dudosa" y no dispara la orden.</li>
                    <li><strong>Filtro de Ruido:</strong> Si hay una noticia económica, los agentes bloquean la operativa automáticamente.</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                    <Calculator className="h-5 w-5" />
                    Fórmulas de Operación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5 font-code text-primary">
                    <p className="text-xs mb-1 opacity-50 uppercase">Resultado Neto:</p>
                    Profit = (Inversión × Payout) - Pérdidas
                  </div>
                  <p className="italic text-[11px]">
                    Si inviertes $4,000 con un payout del 85%, tu ganancia neta es de $3,400. Si pierdes, se restan $4,000. El bot busca alcanzar tu **Take Profit ($60,000)** de forma progresiva.
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
              <h2 className="text-3xl font-headline font-bold">Umbrales de RSI V7</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm">
              La V7 utiliza tres niveles críticos de RSI para determinar puntos de reversión en velas de 1 minuto:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center">
                <div className="text-4xl font-black text-primary mb-2">20</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MIN (Sobreventa)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">El precio ha caído demasiado rápido. La IA se prepara para un **CALL** (Compra).</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center border-primary/20 bg-primary/5">
                <div className="text-4xl font-black text-secondary mb-2">38</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MED (Equilibrio)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">Punto de control de tendencia. La IA valida si el movimiento tiene fuerza para continuar.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center">
                <div className="text-4xl font-black text-red-500 mb-2">62</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">MAX (Sobrecompra)</h4>
                <p className="text-[11px] text-muted-foreground mt-2">El precio está inflado. La IA busca una oportunidad de **PUT** (Venta).</p>
              </div>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Protocolos de Seguridad</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card/50 border border-white/5 p-8 rounded-3xl">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-primary" /> Paso a Paso para Operar</h4>
                <ol className="text-sm text-muted-foreground space-y-3 list-decimal pl-4">
                  <li>Vincula tu cuenta de bróker en la sección <strong>Conexión Bróker</strong>.</li>
                  <li>Configura tus límites de <strong>Take Profit ($60,000)</strong> y <strong>Stop Loss ($8,000)</strong>.</li>
                  <li>Selecciona los clústeres de activos (ej: <strong>EURUSD-OTC</strong>).</li>
                  <li>Activa el <strong>Motor V7</strong> y monitorea el Terminal en tiempo real.</li>
                </ol>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2"><Sliders className="h-4 w-4 text-yellow-500" /> Kill Switch</h4>
                <p className="text-sm text-muted-foreground">
                  Si el bot pierde **2 veces seguidas**, se detendrá automáticamente durante 15 minutos. Esto protege tu capital contra rachas negativas o volatilidad inesperada del bróker.
                </p>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 items-center">
                  <Info className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-500/80 font-bold uppercase">Latencia de ejecución estimada: 8 microsegundos.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
