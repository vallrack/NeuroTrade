'use client';

import { useState, useEffect, useMemo } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  Loader2, 
  Target,
  ChevronRight,
  Save,
  Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

export default function RiskPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    investmentPerTrade: 1000,
    stopLoss: 5000,
    takeProfit: 10000,
    maxDailyTrades: 20,
    martingaleMultiplier: 2.1,
    min_confidence_score: 85
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  
  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  useEffect(() => {
    if (botParams) {
      setFormData({
        investmentPerTrade: botParams.investmentPerTrade || 1000,
        stopLoss: botParams.stopLoss || 5000,
        takeProfit: botParams.takeProfit || 10000,
        maxDailyTrades: botParams.maxDailyTrades || 20,
        martingaleMultiplier: botParams.martingaleMultiplier || 2.1,
        min_confidence_score: botParams.min_confidence_score || 85
      });
    }
  }, [botParams]);

  const handleSave = async () => {
    if (!firestore || !botParamsRef) return;
    setSaving(true);
    try {
      await updateDoc(botParamsRef, {
        ...formData,
        lastUpdated: new Date(),
        updatedBy: user?.email
      });
      
      toast({
        title: "PROTOCOLOS ACTUALIZADOS",
        description: "Los parámetros de riesgo han sido sincronizados.",
      });
      
      window.dispatchEvent(new CustomEvent('nt_force_sync', { detail: formData }));
    } catch (e: any) {
      toast({
        title: "ERROR DE PERSISTENCIA",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
  };

  if (!mounted) return null;

  return (
    <>
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="hidden sm:block mr-2 h-4" />
          <h1 className="font-headline text-lg font-bold tracking-tight text-white truncate">Seguridad Cuántica</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
         <div className="flex flex-col gap-2 mb-6">
            <h2 className="text-3xl font-black font-headline tracking-tighter text-white">Gestión de Riesgo V7</h2>
            <p className="text-muted-foreground text-sm font-medium italic">Configure los muros de contención algorítmica.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tarjeta de Apalancamiento */}
            <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-primary/20 transition-all">
                <CardHeader className="pb-2">
                  <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Apalancamiento V7</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Monto por Operación</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                      <Input 
                        type="number"
                        value={formData.investmentPerTrade}
                        onChange={(e) => handleInputChange('investmentPerTrade', e.target.value)}
                        className="bg-white/5 border-white/10 pl-8 h-12 font-mono text-lg font-bold text-white focus:ring-primary"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">Inversión calculada por cada ciclo de la IA.</p>
                </CardContent>
            </Card>

            {/* Tarjeta de Firewall (Stop Loss) */}
            <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-destructive/20 transition-all">
                <CardHeader className="pb-2">
                  <div className="p-2 bg-destructive/10 rounded-lg w-fit mb-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Firewall de Pérdidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Stop Loss Diario (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                      <Input 
                        type="number"
                        value={formData.stopLoss}
                        onChange={(e) => handleInputChange('stopLoss', e.target.value)}
                        className="bg-white/5 border-white/10 pl-8 h-12 font-mono text-lg font-bold text-destructive focus:ring-destructive"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">El bot hibernará automáticamente al alcanzar esta pérdida.</p>
                </CardContent>
            </Card>

            {/* Confianza Mínima */}
            <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-blue-400/20 transition-all">
                <CardHeader className="pb-2">
                  <div className="p-2 bg-blue-400/10 rounded-lg w-fit mb-2">
                    <Target className="w-5 h-5 text-blue-400" />
                  </div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Filtro de IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Precisión Mínima (%)</Label>
                    <div className="relative">
                      <Input 
                        type="number"
                        min="50"
                        max="100"
                        value={formData.min_confidence_score}
                        onChange={(e) => handleInputChange('min_confidence_score', e.target.value)}
                        className="bg-white/5 border-white/10 h-12 font-mono text-lg font-bold text-blue-400 focus:ring-blue-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">Umbral mínimo para permitir una entrada al mercado.</p>
                </CardContent>
            </Card>
         </div>

         <div className="flex justify-center pt-8 pb-12">
            <Button 
                onClick={handleSave}
                disabled={saving || paramsLoading}
                className="bg-primary hover:bg-primary/90 text-white h-14 px-12 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(var(--primary),0.3)] gap-3 transition-all hover:scale-105 active:scale-95"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Guardar Protocolos de Riesgo
            </Button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 space-y-4">
                 <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/20 rounded-lg shrink-0">
                      <Lock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white uppercase mb-1">Encripción de Seguridad</p>
                       <p className="text-[10px] text-muted-foreground leading-relaxed">
                         Estos parámetros se inyectan directamente en el núcleo HFT de Render. Una vez guardados, la IA ajusta su comportamiento en el siguiente tick del mercado.
                       </p>
                    </div>
                 </div>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/5 border-secondary/20">
              <CardContent className="pt-6 space-y-4">
                 <div className="flex items-start gap-4">
                    <div className="p-2 bg-secondary/20 rounded-lg shrink-0">
                      <Zap className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white uppercase mb-1">Martingale V7.1</p>
                       <p className="text-[10px] text-muted-foreground leading-relaxed">
                         El multiplicador actual está configurado en <span className="font-bold text-secondary font-mono">{formData.martingaleMultiplier}x</span>. Use con precaución en cuentas con balance menor a $1,000 USD.
                       </p>
                    </div>
                 </div>
              </CardContent>
            </Card>
         </div>
      </main>
    </>
  );
}
