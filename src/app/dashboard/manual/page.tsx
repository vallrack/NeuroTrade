
'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BookOpen, Brain, TrendingUp, ShieldCheck, Zap, Info, Target, 
  Layers, Sliders, Cpu, Activity, Globe, Gauge, Calculator, MousePointer2, AlertTriangle,
  Code2, Network, ShieldAlert, Workflow
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ManualPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2 uppercase tracking-tight">
            <BookOpen className="h-5 w-5 text-primary" />
            MANUAL TÉCNICO V7 - NÚCLEO MAESTRO
          </h1>
        </header>

        <main className="p-6 max-w-6xl mx-auto space-y-10 pb-20">
          <Tabs defaultValue="ia" className="space-y-8">
            <TabsList className="bg-card/50 border border-white/5 p-1 h-14">
              <TabsTrigger value="ia" className="gap-2 px-6 data-[state=active]:bg-primary"><Brain className="h-4 w-4" /> Inteligencia V7</TabsTrigger>
              <TabsTrigger value="bridge" className="gap-2 px-6 data-[state=active]:bg-primary"><Network className="h-4 w-4" /> Puente & WebSocket</TabsTrigger>
              <TabsTrigger value="risk" className="gap-2 px-6 data-[state=active]:bg-primary"><ShieldCheck className="h-4 w-4" /> Gestión de Riesgo</TabsTrigger>
            </TabsList>

            <TabsContent value="ia" className="space-y-8 animate-in fade-in duration-500">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-headline font-bold">Protocolo de Consenso Distribuido</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  El motor **NeuroTrade V7** no depende de una sola IA. Utiliza un comité de 5 agentes especializados que analizan ráfagas de datos en microsegundos antes de emitir una señal HFT.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <Target className="h-5 w-5" />
                        Reglas de Ejecución Cuántica
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                      <p>El bot aplica filtros de alta fidelidad para asegurar la precisión:</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Consenso Maestro (80%+):</strong> Requiere que 4 de los 5 agentes coincidan en la dirección.</li>
                        <li><strong>Filtro de Ruido Volátil:</strong> Si la volatilidad excede el umbral configurado, la IA bloquea la operativa.</li>
                        <li><strong>Detección de Reversión:</strong> Utiliza el RSI Cuántico en temporalidades de 1 minuto (M1).</li>
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
                        <p className="text-[10px] mb-1 opacity-50 uppercase font-bold">Cálculo de Beneficio Neto:</p>
                        Profit = (Monto × Payout%) - Coste
                      </div>
                      <p className="italic text-[11px] leading-relaxed">
                        Con una inversión de **$4,000** y un payout del 85%, el beneficio es de **$3,400**. El sistema busca alcanzar el **Take Profit de $60,000** mediante una progresión controlada.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center shadow-lg">
                    <div className="text-4xl font-black text-primary mb-2">20</div>
                    <h4 className="font-bold text-white uppercase text-xs tracking-widest">MIN (Sobreventa)</h4>
                    <p className="text-[11px] text-muted-foreground mt-2">Nivel crítico de agotamiento. La IA busca una entrada en **CALL**.</p>
                  </div>
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl text-center shadow-xl">
                    <div className="text-4xl font-black text-secondary mb-2">38</div>
                    <h4 className="font-bold text-white uppercase text-xs tracking-widest">MED (Equilibrio)</h4>
                    <p className="text-[11px] text-muted-foreground mt-2">Punto de control dinámico para validar la tendencia.</p>
                  </div>
                  <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl text-center shadow-lg">
                    <div className="text-4xl font-black text-red-500 mb-2">62</div>
                    <h4 className="font-bold text-white uppercase text-xs tracking-widest">MAX (Sobrecompra)</h4>
                    <p className="text-[11px] text-muted-foreground mt-2">Agotamiento alcista detectado. La IA busca entrada en **PUT**.</p>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="bridge" className="space-y-8 animate-in fade-in duration-500">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Network className="h-6 w-6 text-secondary" />
                  </div>
                  <h2 className="text-3xl font-headline font-bold">Arquitectura de Puente & Multi-Bróker</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        IQ Option (WSS)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-[11px] text-muted-foreground space-y-3">
                      <p><strong>Login Protocol:</strong> HTTP POST a /api/login/v2 para obtención de SSID.</p>
                      <p><strong>WebSocket:</strong> Conexión persistente a /echo/websocket con eventos JSON.</p>
                      <p><strong>Operativa:</strong> Uso de buyV3 para ejecución con latencia &lt;80ms.</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Alpaca (REST/API)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-[11px] text-muted-foreground space-y-3">
                      <p><strong>Entorno:</strong> Soporte nativo para Paper Trading y Live Accounts.</p>
                      <p><strong>Ejecución:</strong> API REST oficial para acciones y cripto.</p>
                      <p><strong>Feed:</strong> WebSockets para datos en tiempo real de alta fidelidad.</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/30 border-white/5 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-sm font-headline flex items-center gap-2">
                        <Coins className="h-4 w-4 text-secondary" />
                        Cripto (CCXT)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-[11px] text-muted-foreground space-y-3">
                      <p><strong>Abstracción:</strong> Capa unificada para Binance, Bybit y más de 100 exchanges.</p>
                      <p><strong>Métodos:</strong> exchange.createOrder() estandarizado para todo el núcleo V7.</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex gap-4 items-start">
                  <Info className="h-5 w-5 text-blue-500 shrink-0 mt-1" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-blue-500 uppercase text-xs tracking-widest">Nota sobre Infraestructura</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Dado que el sistema corre en entornos Serverless, el WebSocket se mantiene mediante un microservicio de puente que garantiza que la conexión no se cierre, permitiendo una ejecución de órdenes ininterrumpida.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="risk" className="space-y-8 animate-in fade-in duration-500">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-red-500" />
                  </div>
                  <h2 className="text-3xl font-headline font-bold">Gestión de Riesgo Blindada</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card/50 border border-white/5 p-8 rounded-3xl shadow-2xl">
                  <div className="space-y-4">
                    <h4 className="font-bold flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /> Secuencia de Seguridad</h4>
                    <ol className="text-sm text-muted-foreground space-y-4 list-decimal pl-4">
                      <li><strong>Verificación de Saldo:</strong> El bot no opera si el saldo es inferior al **Monto Mínimo ($2,000)**.</li>
                      <li><strong>Límite de Pérdidas:</strong> Si se alcanzan **2 pérdidas consecutivas**, el bot entra en modo de hibernación por 15 minutos.</li>
                      <li><strong>Stop Loss Global:</strong> Apagado inmediato del núcleo si la pérdida diaria alcanza los **$8,000**.</li>
                    </ol>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-bold flex items-center gap-2 text-yellow-500"><ShieldAlert className="h-4 w-4" /> Alerta de Martingala</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      La estrategia Martingala duplica el monto tras una pérdida. En la Versión 7, este protocolo es **opcional** y se recomienda solo para operadores con balance superior a $20,000 debido al riesgo de drawdown exponencial.
                    </p>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-[10px] text-yellow-500/90 font-bold uppercase tracking-tight">Latencia del Kill-Switch: < 100 microsegundos.</p>
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
