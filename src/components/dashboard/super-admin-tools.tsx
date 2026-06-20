
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ShieldCheck, Database, Users, Settings2, RefreshCw, Trash2, Zap } from 'lucide-react';
import { promoteToSuperAdmin, clearSystemLogs, seedDemoData } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

export function SuperAdminTools() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSelfPromotion = async () => {
    if (!user) return;
    setLoading(true);
    const result = await promoteToSuperAdmin(user.uid);
    setLoading(false);
    
    if (result.success) {
      toast({
        title: "PRIVILEGIOS MAESTROS ACTIVADOS",
        description: "Tu cuenta ahora tiene acceso total a la infraestructura cuántica.",
      });
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    const result = await seedDemoData();
    setSeeding(false);
    
    if (result.success) {
      toast({
        title: "DATOS INICIALIZADOS",
        description: "El dashboard ha sido poblado con métricas en tiempo real.",
      });
    }
  };

  const handleClearLogs = async () => {
    const result = await clearSystemLogs();
    if (result.success) {
      toast({
        title: "SISTEMA DEPURADO",
        description: "Los registros históricos han sido archivados y limpiados.",
      });
    }
  };

  return (
    <Card className="bg-primary/5 border-primary/20 shadow-lg shadow-primary/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Crown className="h-24 w-24 text-primary" />
      </div>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary hover:bg-primary font-headline px-3 py-1 gap-1">
            <Crown className="h-3 w-3" />
            SUPER ADMIN
          </Badge>
        </div>
        <CardTitle className="font-headline text-xl mt-2">Centro de Control Maestro</CardTitle>
        <CardDescription>Gestión avanzada de la arquitectura NeuroTrade.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleSeedData}
            disabled={seeding}
            variant="outline" 
            className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12 text-xs"
          >
            <Zap className={`h-4 w-4 text-primary ${seeding ? 'animate-pulse' : ''}`} />
            Inicializar Datos
          </Button>
          <Button 
            onClick={handleClearLogs}
            variant="outline" 
            className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12 text-xs"
          >
            <Trash2 className="h-4 w-4 text-primary" />
            Limpiar Memoria
          </Button>
          <Button variant="outline" className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12 text-xs">
            <Database className="h-4 w-4 text-primary" />
            Bypass DB
          </Button>
          <Button 
            onClick={handleSelfPromotion} 
            disabled={loading}
            className="justify-start gap-2 h-12 bg-primary hover:bg-primary/90 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar Rango
          </Button>
        </div>
        
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Estado de Red: SEGURA
            </p>
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <p className="text-[10px] text-primary/70 italic leading-tight">
            Privilegios de Nivel 5 detectados. Acceso a reconfiguración de ejército AI y protocolos de borrado habilitados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
