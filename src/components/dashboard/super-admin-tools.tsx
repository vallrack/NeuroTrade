
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ShieldCheck, Database, Users, Settings2, RefreshCw } from 'lucide-react';
import { promoteToSuperAdmin } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

export function SuperAdminTools() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSelfPromotion = async () => {
    if (!user) return;
    setLoading(true);
    const result = await promoteToSuperAdmin(user.uid);
    setLoading(false);
    
    if (result.success) {
      toast({
        title: "PRIVILEGIOS MAESTROS ACTIVADOS",
        description: "Tu cuenta ahora tiene acceso total al núcleo del sistema.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "FALLO DE PROTOCOLO",
        description: "No se pudieron establecer privilegios maestros.",
      });
    }
  };

  return (
    <Card className="bg-primary/5 border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Crown className="h-24 w-24 text-primary" />
      </div>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary hover:bg-primary font-headline px-3 py-1 gap-1">
            <Crown className="h-3 w-3" />
            SUPER ADMIN
          </Badge>
        </div>
        <CardTitle className="font-headline text-xl mt-2">Herramientas del Administrador Maestro</CardTitle>
        <CardDescription>Control absoluto sobre la arquitectura NeuroTrade.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12">
            <Users className="h-4 w-4" />
            Gestionar Usuarios
          </Button>
          <Button variant="outline" className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12">
            <Database className="h-4 w-4" />
            Limpiar Logs
          </Button>
          <Button variant="outline" className="justify-start gap-2 border-primary/20 hover:bg-primary/10 h-12">
            <Settings2 className="h-4 w-4" />
            Núcleo AI
          </Button>
          <Button 
            onClick={handleSelfPromotion} 
            disabled={loading}
            className="justify-start gap-2 h-12 bg-primary hover:bg-primary/90"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Forzar Rango Maestro
          </Button>
        </div>
        
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <ShieldCheck className="h-3 w-3" />
            Estado de Seguridad: NIVEL 5
          </p>
          <p className="text-[10px] text-primary/70 italic leading-tight">
            Acceso habilitado a bypass de seguridad, gestión de nodos y reconfiguración de ejército AI.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
