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
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { BrainCircuit, Play, Pause } from 'lucide-react';
import { playInvestSound } from '@/lib/sounds';

export function AiArmyPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptData, setPromptData] = useState<any>(null);
  
  const { forceStartEngine } = useBotEngine();
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const handleArmyPrompt = (e: any) => {
      setPromptData(e.detail);
      setIsOpen(true);
      
      // Opcional: Reproducir un sonido para llamar la atención del usuario
      try {
        playInvestSound(); // Usamos el sonido de invest como notificación
      } catch (err) {}
    };

    window.addEventListener('nt_ai_army_prompt', handleArmyPrompt);
    return () => window.removeEventListener('nt_ai_army_prompt', handleArmyPrompt);
  }, []);

  const handleApplyAndOperate = async () => {
    if (user && firestore && promptData) {
      const botParamsDoc = doc(firestore, 'users', user.uid, 'config', 'bot_params');
      try {
        await setDoc(botParamsDoc, {
          compoundPercentage: promptData.newCompoundPercent,
          dailyGoalPercent: promptData.newGoalPercent,
          moneyManagementMode: 'compound' // Asegurar modo compuesto
        }, { merge: true });
      } catch (err) {
        console.error("Error updating AI params:", err);
      }
    }
    
    setIsOpen(false);
    forceStartEngine();
  };

  const handleIgnoreAndOperate = () => {
    setIsOpen(false);
    forceStartEngine();
  };

  if (!promptData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleIgnoreAndOperate(); 
    }}>
      <DialogContent className="sm:max-w-md bg-black/95 border-white/10 backdrop-blur-xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span className="text-primary">Análisis del Ejército de IA</span>
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-sm mt-4 leading-relaxed font-mono whitespace-pre-wrap">
            El escuadrón ha terminado el reconocimiento del mercado. 
            <br/><br/>
            Probabilidad estimada de éxito: <strong className={promptData.avgProb >= 75 ? "text-emerald-400" : promptData.avgProb < 60 ? "text-rose-400" : "text-amber-400"}>{promptData.avgProb.toFixed(1)}% ({promptData.riskLevel})</strong>
            <br/><br/>
            Según estas condiciones, sugerimos los siguientes parámetros para operar de forma segura hoy:
            <br/><br/>
            <ul className="list-disc pl-5 space-y-1">
              <li>Inversión por Operación: <strong className="text-white">{promptData.newCompoundPercent}%</strong></li>
              <li>Meta Diaria: <strong className="text-white">{promptData.newGoalPercent}%</strong></li>
            </ul>
            <br/>
            ¿Deseas aplicar estos ajustes y operar, o prefieres mantener tu configuración actual?
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            onClick={handleApplyAndOperate}
          >
            <Play className="w-4 h-4 mr-2" />
            Sí, aplicar y operar
          </Button>
          <Button 
            variant="default" 
            className="w-full sm:w-auto bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 border border-slate-500/50"
            onClick={handleIgnoreAndOperate}
          >
            <Play className="w-4 h-4 mr-2" />
            No, mantener mi configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
