
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BookOpen, Brain, TrendingUp, ShieldCheck, Zap, Info, Target, 
  Layers, Sliders, Cpu, Activity, Globe, Scale, Gauge, Calculator
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
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Cómo la IA Toma Decisiones</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              El motor NeuroTrade V7 no opera basándose en impulsos. Utiliza un **Comité de Inteligencia Colectiva** de 5 agentes especializados. Cada agente analiza el mercado con un enfoque distinto (tendencia, volumen, RSI, micro-volatilidad y soportes).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    El Factor de Consenso
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>Para que se ejecute una operación (CALL/PUT), se requiere un **Consenso > 75%**.</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>4 de 5 agentes:</strong> Nivel de confianza ALTO. El bot dispara la orden.</li>
                    <li><strong>3 de 5 agentes:</strong> Nivel NEUTRAL. El bot se mantiene en modo vigilancia.</li>
                    <li><strong>Divergencia Total:</strong> El bot asume mercado errático y detiene el análisis temporalmente.</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-secondary" />
                    Fórmulas de Beneficio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5 font-code text-primary">
                    <p className="text-xs mb-1 text-muted-foreground uppercase">Cálculo de Operación:</p>
                    Profit = Inversión × Payout (%)
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Ejemplo: Con una inversión V7 de $4,000 y un Payout del 85%, el beneficio neto es de $3,400 por minuto. Si la operación es fallida, el balance se reduce exactamente por el monto de la inversión.
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
            <p className="text-muted-foreground leading-relaxed">
              En la Versión 7, los niveles de RSI no son estándar. Se han calibrado para detectar micro-reversiones en gráficos de 1 minuto:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center space-y-3">
                <div className="text-4xl font-black text-primary">20</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">Mínimo (Sobreventa)</h4>
                <p className="text-[11px] text-muted-foreground">Punto crítico de pánico en el mercado. La IA busca confirmación para un **CALL** masivo.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center space-y-3">
                <div className="text-4xl font-black text-secondary">38</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">Medio (Control)</h4>
                <p className="text-[11px] text-muted-foreground">Zona de decisión. Aquí la IA valida si la tendencia tiene "gasolina" para continuar.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center space-y-3">
                <div className="text-4xl font-black text-red-500">62</div>
                <h4 className="font-bold text-white uppercase text-xs tracking-widest">Máximo (Sobrecompra)</h4>
                <p className="text-[11px] text-muted-foreground">Límite de agotamiento de compradores. La IA prepara un **PUT** preventivo.</p>
              </div>
            </div>
          </section>

          <Separator className="opacity-10" />

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-3xl font-headline font-bold">Protocolos de Riesgo V7</h2>
            </div>
            <div className="p-8 bg-card/50 border border-white/5 rounded-3xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <h4 className="font-bold flex items-center gap-2"><Sliders className="h-4 w-4 text-primary" /> Stop Loss y Take Profit</h4>
                  <p className="text-sm text-muted-foreground">
                    El **Take Profit ($60,000)** es tu meta diaria. Una vez alcanzado, el bot se desconecta para proteger ganancias. El **Stop Loss ($8,000)** es tu escudo. Si las pérdidas acumuladas llegan a este punto, se activa el "Kill Switch".
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> Pérdidas Consecutivas</h4>
                  <p className="text-sm text-muted-foreground">
                    Si el bot detecta **2 pérdidas seguidas**, asume que el mercado está en un estado de caos (noticias de alto impacto) y pausa la operativa durante 15 minutos para recalibrar.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-4">
                <Info className="h-5 w-5 text-primary shrink-0 mt-1" />
                <p className="text-xs text-primary/80 italic">
                  <strong>Recomendación:</strong> Siempre opere en horarios de alta liquidez (07:00 a 11:00 EST) para que los umbrales de RSI V7 tengan máxima precisión.
                </p>
              </div>
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
