'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ShieldCheck, Database, Users, Settings2, RefreshCw, Trash2, Zap, Loader2 } from 'lucide-react';
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
    if (!user) return;
    setSeeding(true);
    const result = await seedDemoData(user.uid);
    setSeeding(false);
    
    if (result.success) {
      toast({
        title: "NÚCLEO V7 SINCRONIZADO",
        description: "Los valores maestros de la imagen V7 han sido cargados en tu perfil.",
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
    <Card className="bg-primary/5 border-primary/20 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Crown className="h-24 w-24 text-primary" />
      </div>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary hover:bg-primary font-headline px-3 py-1 gap-1">
            <Crown className="h-3 w-3" />
            MAESTRO CUÁNTICO
          </Badge>
        </div>
        <CardTitle className="font-headline text-xl mt-2">Protocolos de Infraestructura</CardTitle>
        <CardDescription className="text-xs">Gestión de nivel absoluto para el Centro de Comando.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleSeedData}
            disabled={seeding}
            variant="outline" 
            className="justify-start gap-2 border-primary/30 hover:bg-primary/10 h-12 text-[10px] font-bold uppercase tracking-wider"
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
            Cargar Valores V7
          </Button>
          <Button 
            onClick={handleClearLogs}
            variant="outline" 
            className="justify-start gap-2 border-primary/30 hover:bg-primary/10 h-12 text-[10px] font-bold uppercase tracking-wider"
          >
            <Trash2 className="h-4 w-4 text-primary" />
            Limpiar Memoria
          </Button>
          <Button variant="outline" className="justify-start gap-2 border-primary/30 hover:bg-primary/10 h-12 text-[10px] font-bold uppercase tracking-wider">
            <Database className="h-4 w-4 text-primary" />
            Bypass DB
          </Button>
          <Button 
            onClick={handleSelfPromotion} 
            disabled={loading}
            className="justify-start gap-2 h-12 bg-primary hover:bg-primary/90 text-[10px] font-bold uppercase tracking-wider"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
