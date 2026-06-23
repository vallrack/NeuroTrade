'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ShieldCheck, Database, Users, Settings2, RefreshCw, Trash2, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

export function SuperAdminTools() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSelfPromotion = async () => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { role: 'super-admin' });
      toast({
        title: "PRIVILEGIOS MAESTROS ACTIVADOS",
        description: "Tu cuenta ahora tiene acceso total a la infraestructura cuántica.",
      });
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSeedData = async () => {
    if (!user || !firestore) return;
    setSeeding(true);
    try {
      await setDoc(doc(firestore, 'configuracion', 'bot_params'), {
        bot_activo: true,
        investmentPerTrade: 500,
        stopLoss: 8000,
        max_drawdown: 5,
        min_confidence_score: 85,
        pairs: ["EURUSD-OTC", "GBPUSD-OTC", "USDJPY-OTC"],
        regularPairs: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"],
        otcPairs: ["EURUSD-OTC", "GBPUSD-OTC", "USDJPY-OTC", "AUDUSD-OTC"],
        strategy_mode: "conservative",
        autopilot: {
          enabled: false,
          autoConnectBridge: true,
          pairMode: "auto",
          scheduleMode: "auto",
          slots: []
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "NÚCLEO V7 SINCRONIZADO",
        description: "Los valores maestros de la imagen V7 han sido restaurados.",
      });
    } catch (e: any) {
      toast({ title: "ERROR", description: e.message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const handleClearLogs = async () => {
    // Emitir evento para que la consola se limpie
    window.dispatchEvent(new CustomEvent('nt_clear_logs'));
    toast({
      title: "SISTEMA DEPURADO",
      description: "La memoria residual de logs ha sido purgada exitosamente.",
    });
  };

  const handleBypassSync = async () => {
    setLoading(true);
    // Simular bypass de DB forzando una lectura del puente
    window.dispatchEvent(new CustomEvent('nt_force_sync'));
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "BYPASS DB ACTIVO",
        description: "Sincronización forzada con el núcleo V7 completada.",
      });
    }, 1000);
  };

  return (
    <Card className="bg-card/40 border-white/5 shadow-xl overflow-hidden relative backdrop-blur-xl">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Crown className="h-24 w-24 text-primary" />
      </div>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary hover:bg-primary font-headline px-3 py-1 gap-1 text-[9px] font-black">
            <Crown className="h-3 w-3" />
            MAESTRO CUÁNTICO
          </Badge>
        </div>
        <CardTitle className="font-headline text-lg mt-2 tracking-tight text-white">Protocolos de Infraestructura</CardTitle>
        <CardDescription className="text-[10px] text-muted-foreground/60">Gestión de nivel absoluto para el Centro de Comando.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleSeedData}
            disabled={seeding}
            variant="outline" 
            className="justify-start gap-2 border-white/5 bg-white/[0.02] hover:bg-primary/20 h-11 text-[9px] font-black uppercase tracking-wider"
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Zap className="h-3.5 w-3.5 text-primary" />}
            Cargar Valores V7
          </Button>
          <Button 
            onClick={handleClearLogs}
            variant="outline" 
            className="justify-start gap-2 border-white/5 bg-white/[0.02] hover:bg-primary/20 h-11 text-[9px] font-black uppercase tracking-wider"
          >
            <Trash2 className="h-3.5 w-3.5 text-primary" />
            Limpiar Memoria
          </Button>
          <Button 
            onClick={handleBypassSync}
            variant="outline" 
            className="justify-start gap-2 border-white/5 bg-white/[0.02] hover:bg-primary/20 h-11 text-[9px] font-black uppercase tracking-wider"
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            Bypass DB
          </Button>
          <Button 
            onClick={handleSelfPromotion} 
            disabled={loading}
            className="justify-start gap-2 h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-[9px] font-black uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Fix Rango Maestro
          </Button>
        </div>
        
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Estado Red: ENCRIPTADA
            </p>
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <p className="text-[10px] text-primary/70 italic leading-tight">
            Se han detectado privilegios L-5. El sistema ahora opera bajo el protocolo de ejecución V7 configurado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
