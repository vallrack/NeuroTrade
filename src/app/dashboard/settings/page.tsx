
'use client';



import { useState, useEffect, useMemo } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon, 
  Bot, 
  Cpu, 
  ShieldCheck, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Globe,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'config', 'bot_params');
  }, [mounted, firestore, user]);

  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  const [minConfidence, setMinConfidence] = useState('85');
  const [maxDrawdown, setMaxDrawdown] = useState('5');
  const [strategyMode, setStrategyMode] = useState('conservative');

  useEffect(() => {
    if (botParams) {
      setMinConfidence(botParams.min_confidence_score?.toString() || '85');
      setMaxDrawdown(botParams.max_drawdown?.toString() || '5');
      setStrategyMode(botParams.strategy_mode || 'conservative');
    }
  }, [botParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const config = {
      min_confidence_score: parseFloat(minConfidence),
      max_drawdown: parseFloat(maxDrawdown),
      strategy_mode: strategyMode,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (firestore) {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(botParamsRef!, config, { merge: true });
        toast({
          title: "NÚCLEO V7 ACTUALIZADO",
          description: "Los parámetros de IA han sido reconfigurados con éxito.",
        });
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "ERROR AL GUARDAR",
        description: error.message || "Permiso denegado o error de conexión.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            Configuración del Sistema
          </h1>
        </header>

        <main className="p-6 max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-headline font-bold text-foreground">Núcleo Central V7</h2>
            <p className="text-muted-foreground italic">Ajuste la sensibilidad y los parámetros heurísticos de la IA.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="bg-card/50 border-white/5 backdrop-blur-xl md:col-span-2">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-primary" />
                          Parámetros de IA
                        </CardTitle>
                        <CardDescription>Confianza y umbrales de ejecución</CardDescription>
                      </div>
                      <Badge className="bg-primary/20 text-primary border-primary/30">HFT ENABLED</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Confianza Mínima (%)</Label>
                        <Input 
                          type="number" 
                          value={minConfidence}
                          onChange={(e) => setMinConfidence(e.target.value)}
                          className="bg-background/50 border-white/5 h-12 text-lg font-code" 
                        />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Umbral mínimo para permitir la entrada de IA.</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Drawdown Máximo (%)</Label>
                        <Input 
                          type="number" 
                          value={maxDrawdown}
                          onChange={(e) => setMaxDrawdown(e.target.value)}
                          className="bg-background/50 border-white/5 h-12 text-lg font-code" 
                        />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Límite de retroceso antes de hibernar el motor.</p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Modo de Estrategia</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {['conservative', 'balanced', 'aggressive'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setStrategyMode(mode)}
                            className={`p-4 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                              strategyMode === mode 
                                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(38,166,154,0.3)]' 
                                : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
               </Card>

               <div className="space-y-6">
                  <Card className="bg-primary/5 border-primary/20 border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Estado del Núcleo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Latencia Puente:</span>
                          <span className="text-green-500 font-code">24ms</span>
                       </div>
                       <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Carga IA:</span>
                          <span className="text-primary font-code">12.4%</span>
                       </div>
                       <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Uptime:</span>
                          <span className="text-white font-code">99.9%</span>
                       </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-white/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
                        <ShieldCheck className="h-4 w-4" />
                        Seguridad L-5
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                       <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/5 p-2 rounded-lg">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          Certificado SSL Activo
                       </div>
                       <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/5 p-2 rounded-lg">
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                          Encripción End-to-End
                       </div>
                    </CardContent>
                  </Card>
               </div>
            </div>

            <Card className="bg-card/50 border-white/5 overflow-hidden">
               <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-3">
                     <div className="p-6 border-b md:border-b-0 md:border-r border-white/5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                        <Globe className="h-8 w-8 text-primary/40" />
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Servidor</p>
                           <p className="text-sm font-code">Vercel (US-EAST)</p>
                        </div>
                     </div>
                     <div className="p-6 border-b md:border-b-0 md:border-r border-white/5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                        <Database className="h-8 w-8 text-primary/40" />
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Base de Datos</p>
                           <p className="text-sm font-code">Firestore G-Cloud</p>
                        </div>
                     </div>
                     <div className="p-6 flex items-center gap-4 hover:bg-white/5 transition-colors">
                        <Cpu className="h-8 w-8 text-primary/40" />
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Procesamiento</p>
                           <p className="text-sm font-code">Arquitectura V7</p>
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="flex justify-end gap-4 items-center">
              <span className="text-[10px] text-muted-foreground/60 italic uppercase font-bold tracking-widest">
                Última sincronización: hace unos segundos
              </span>
              <Button type="submit" disabled={loading} className="gap-2 px-10 h-14 font-headline tracking-widest uppercase shadow-xl shadow-primary/20">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Actualizar Núcleo
              </Button>
            </div>
          </form>
      </main>
    </>
  );
}
