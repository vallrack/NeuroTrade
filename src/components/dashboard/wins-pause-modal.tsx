'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { AlertTriangle, Clock, Play, PowerOff } from 'lucide-react';

export function WinsPauseModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1: Continuar vs Parar, 2: Más tarde vs Definitivo
  const [winsCount, setWinsCount] = useState(3);
  const [suggestion, setSuggestion] = useState<string>('');
  
  const { toggleEngine, isRunning } = useBotEngine();

  useEffect(() => {
    const handleWinsPrompt = (e: any) => {
      const { wins, hourlyStats } = e.detail;
      setWinsCount(wins);
      
      // Calcular hora sugerida
      let bestHour = '10:00'; // fallback
      let maxWins = -1;
      
      if (hourlyStats) {
        Object.entries(hourlyStats).forEach(([hour, stats]: [string, any]) => {
          if (stats.wins > maxWins) {
            maxWins = stats.wins;
            bestHour = hour;
          }
        });
      }
      
      // Format hour for suggestion (e.g., 10:00 => 10:00 AM)
      const date = new Date();
      const [h, m] = bestHour.split(':');
      date.setHours(parseInt(h, 10), parseInt(m, 10));
      const formattedTime = date.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      setSuggestion(`Según tu historial de hoy, tu rango más productivo es alrededor de las ${formattedTime}. Te sugerimos volver en ese horario para mantener tu racha positiva.`);
      
      setStep(1);
      setIsOpen(true);
    };

    window.addEventListener('nt_wins_pause_prompt', handleWinsPrompt);
    return () => window.removeEventListener('nt_wins_pause_prompt', handleWinsPrompt);
  }, []);

  const handleContinue = () => {
    setIsOpen(false);
    // Reactivar el motor si está pausado
    if (!isRunning) {
      toggleEngine(); // esto reactivará el motor e iniciará el ciclo en modo Pre-análisis o Directo
    }
  };

  const handleStopNow = () => {
    setStep(2);
  };

  const handleLater = () => {
    setIsOpen(false);
    // El motor ya está pausado, se queda así
  };

  const handleCloseSession = () => {
    setIsOpen(false);
    // Disparar desconexión manual para guardar reporte y avanzar día
    window.dispatchEvent(new Event('nt_manual_disconnect'));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleLater(); 
    }}>
      <DialogContent className="sm:max-w-md bg-black/95 border-white/10 backdrop-blur-xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            {step === 1 ? (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <span className="text-amber-500">Pausa Estratégica Automática</span>
              </>
            ) : (
              <>
                <PowerOff className="h-6 w-6 text-rose-500" />
                <span className="text-rose-500">Confirmar Cierre de Sesión</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-sm mt-4 leading-relaxed font-mono whitespace-pre-wrap">
            {step === 1 ? (
              <>
                ¡Excelente trabajo! Has logrado <strong className="text-emerald-400">{winsCount} operaciones ganadoras</strong> recientemente.
                <br/><br/>
                Para proteger tus ganancias y evitar el <em>sobreoperar (overtrading)</em>, hemos pausado temporalmente el motor.
                <br/><br/>
                ¿Deseas continuar operando ahora mismo o prefieres asegurar tus ganancias por el momento?
              </>
            ) : (
              <>
                Entendido. El descanso es parte fundamental del trading exitoso.
                <br/><br/>
                <div className="bg-primary/10 border border-primary/20 p-3 rounded-md flex gap-3 items-start my-2">
                  <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-primary text-xs">{suggestion}</span>
                </div>
                <br/>
                ¿Quieres dejar la sesión en pausa para volver más tarde, o cerramos definitivamente la sesión por hoy para generar tu informe de eficiencia y avanzar al siguiente día?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          {step === 1 ? (
            <>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                onClick={handleContinue}
              >
                <Play className="w-4 h-4 mr-2" />
                Sí, continuar operando
              </Button>
              <Button 
                variant="default" 
                className="w-full sm:w-auto bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50"
                onClick={handleStopNow}
              >
                <PowerOff className="w-4 h-4 mr-2" />
                No, detener por ahora
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto border-slate-500/50 text-slate-300 hover:bg-slate-800"
                onClick={handleLater}
              >
                Me conectaré más tarde
              </Button>
              <Button 
                variant="default" 
                className="w-full sm:w-auto bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/50"
                onClick={handleCloseSession}
              >
                Cerrar sesión definitivamente
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
