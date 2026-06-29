'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, Target } from 'lucide-react';

export function PlanTracker() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'config', 'bot_params');
  }, [mounted, firestore, user]);
  
  const { data: botParams } = useDoc(botParamsRef);
  
  // Auto-avance de día basado en la fecha calendario local
  useEffect(() => {
    if (!mounted || !botParamsRef || !botParams) return;
    
    const today = new Date().toLocaleDateString();
    
    if (!botParams.lastActiveDate) {
      // Registrar por primera vez la fecha de inicio
      setDoc(botParamsRef, { lastActiveDate: today }, { merge: true }).catch(console.error);
    } else if (botParams.lastActiveDate !== today) {
      // Es un nuevo día calendario desde la última vez
      const currentDay = botParams.planDay || 1;
      
      if (currentDay < 15) {
        const nextDay = currentDay + 1;
        const phaseNumber = nextDay <= 5 ? 1 : nextDay <= 10 ? 2 : 3;
        const dayInPhase = nextDay <= 5 ? nextDay : nextDay <= 10 ? nextDay - 5 : nextDay - 10;
        const newGoal = 60 + (dayInPhase - 1) * 10;
        
        setDoc(botParamsRef, {
          planDay: nextDay,
          planPhase: phaseNumber,
          dailyGoalPercent: newGoal,
          lastActiveDate: today,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(console.error);
      } else {
        // Ya completó los 15 días, solo actualizar la fecha
        setDoc(botParamsRef, { lastActiveDate: today }, { merge: true }).catch(console.error);
      }
    }
  }, [mounted, botParams?.lastActiveDate, botParams?.planDay, botParamsRef]);

  if (!mounted || !botParams || !botParams.planPhase || !botParams.planDay) return null;
  
  const { planPhase, planDay, dailyGoalPercent } = botParams;
  const handleDayChange = async () => {
    const newDayStr = window.prompt(`Estás en el Día ${planDay}. ¿A qué día quieres saltar manualmente? (1-15):`, String(planDay));
    if (!newDayStr) return;
    const newDay = parseInt(newDayStr);
    if (isNaN(newDay) || newDay < 1 || newDay > 15) {
      alert("Día inválido. Debe ser del 1 al 15.");
      return;
    }
    
    // Determinar la fase en base al nuevo día
    const phaseNumber = newDay <= 5 ? 1 : newDay <= 10 ? 2 : 3;
    const dayInPhase = newDay <= 5 ? newDay : newDay <= 10 ? newDay - 5 : newDay - 10;
    const newGoal = 60 + (dayInPhase - 1) * 10;
    
    try {
      if (!botParamsRef) {
        alert("No se pudo cargar la referencia de configuración");
        return;
      }
      await setDoc(botParamsRef, {
        planDay: newDay,
        planPhase: phaseNumber,
        dailyGoalPercent: newGoal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert(`¡Saltaste al Día ${newDay} (Fase ${phaseNumber})!`);
    } catch (err: any) {
      alert("Error cambiando de día: " + err.message);
    }
  };

  const progress = (planDay / 15) * 100;
  
  return (
    <Card className="bg-gradient-to-r from-slate-900/80 to-slate-900/50 border-white/10 shadow-lg mb-6">
      <CardContent className="p-4 sm:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-8">
        
        <div className="flex-1 w-full space-y-2">
          <div className="flex justify-between items-center text-sm">
            <h3 className="font-bold flex items-center gap-2 text-white/90">
              <CalendarDays className="h-4 w-4 text-primary" />
              Progreso del Plan de 15 Días
            </h3>
            <span 
              className="text-muted-foreground font-mono cursor-pointer hover:text-white transition-colors"
              onClick={handleDayChange}
              title="Clic para cambiar de día manualmente"
            >
              Día {planDay} de 15
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <div className="flex items-center gap-6 w-full md:w-auto shrink-0 bg-black/20 p-3 rounded-lg border border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Fase Actual</span>
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${planPhase === 1 ? 'bg-rose-500' : planPhase === 2 ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
              {planPhase === 1 ? '1: Contrariana' : planPhase === 2 ? '2: Tendencial' : '3: Inteligente'}
            </span>
          </div>
          
          <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
          
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Meta Diaria</span>
            <span className="text-sm font-bold text-green-400 flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              {dailyGoalPercent}%
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
