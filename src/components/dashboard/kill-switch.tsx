
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { PowerOff, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { playAlarm } from '@/lib/sounds';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function KillSwitch() {
  const [isKilling, setIsKilling] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();

  const handleKill = async () => {
    setIsKilling(true);
    playAlarm();
    
    let success = false;
    try {
      if (firestore) {
        await updateDoc(doc(firestore, 'configuracion', 'bot_params'), { bot_activo: false });
        success = true;
      }
    } catch (e) {
      console.error(e);
    }
    
    setIsKilling(false);
    
    if (success) {
      toast({
        title: "PARADA GLOBAL ACTIVADA",
        description: "Todas las actividades del bot han sido abortadas inmediatamente.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "ERROR CRÍTICO",
        description: "Fallo al transmitir señal de parada. Verifique conectividad.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive" 
          className="w-full h-12 md:h-14 font-headline text-[10px] md:text-xs font-black tracking-widest gap-2 shadow-lg shadow-red-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <PowerOff className="h-4 w-4" />
          ABORTO DE EMERGENCIA
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            CONFIRMAR PARADA DE EMERGENCIA
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Esto desactivará inmediatamente el motor de trading y forzará el cierre de todas las cadenas de ejecución pendientes en todos los brókeres vinculados. 
            Latencia estimada: &lt;100ms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10">Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleKill} 
            className="bg-destructive hover:bg-destructive/90 text-white"
            disabled={isKilling}
          >
            {isKilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            EJECUTAR ABORTO
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
