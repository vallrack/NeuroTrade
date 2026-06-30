'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { BrainCircuit, Play, ShieldAlert, Target, Percent, ArrowRight, Zap } from 'lucide-react';
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
      
      // Reproducir sonido para llamar la atención del usuario
      try {
        playInvestSound();
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

  // Determinar colores basados en la probabilidad
  const isHighProb = promptData.avgProb >= 75;
  const isMedProb = promptData.avgProb >= 60 && promptData.avgProb < 75;
  const probColor = isHighProb ? "text-emerald-400" : isMedProb ? "text-amber-400" : "text-rose-400";
  const probBg = isHighProb ? "bg-emerald-500/10 border-emerald-500/20" : isMedProb ? "bg-amber-500/10 border-amber-500/20" : "bg-rose-500/10 border-rose-500/20";
  const probIconColor = isHighProb ? "text-emerald-500" : isMedProb ? "text-amber-500" : "text-rose-500";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleIgnoreAndOperate(); 
    }}>
      <DialogContent className="sm:max-w-lg bg-[#0a0d14] border-white/10 backdrop-blur-xl z-[9999] p-0 overflow-hidden shadow-2xl">
        {/* Decorative Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
        
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                <BrainCircuit className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Análisis Cuántico Finalizado
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Resultados del reconocimiento de mercado por la IA.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <p className="text-slate-300 text-[15px] leading-relaxed">
              El escuadrón de IA ha terminado el reconocimiento del mercado y evaluado las condiciones actuales para la sesión.
            </p>

            {/* Probability Card */}
            <div className={`p-4 rounded-xl border flex flex-col gap-2 ${probBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-5 h-5 ${probIconColor}`} />
                  <span className="text-slate-200 font-medium text-sm">Probabilidad de Éxito</span>
                </div>
                <span className={`font-bold text-lg ${probColor}`}>
                  {promptData.avgProb.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-slate-400 pl-7">
                Riesgo del Mercado: <span className="text-white font-medium">{promptData.riskLevel}</span>
              </div>
              {promptData.avgRsi != null && (
                <div className="text-xs text-slate-400 pl-7 flex gap-4">
                  <span>RSI Promedio: <span className="text-white font-medium">{promptData.avgRsi}</span></span>
                  <span>Señales detectadas: <span className="text-white font-medium">{promptData.signalCount ?? 0}</span></span>
                </div>
              )}
            </div>

            {/* Recommendations Grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wider">Ajustes Sugeridos</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1 transition-colors hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Percent className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Inversión</span>
                  </div>
                  <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                    {promptData.newCompoundPercent}<span className="text-base text-slate-400 font-normal">%</span>
                  </div>
                  <div className="text-xs text-slate-500">Monto por operación</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1 transition-colors hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Meta Diaria</span>
                  </div>
                  <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                    {promptData.newGoalPercent}<span className="text-base text-slate-400 font-normal">%</span>
                  </div>
                  <div className="text-xs text-slate-500">Objetivo de la sesión</div>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-slate-400 text-center font-medium mt-4">
              ¿Deseas aplicar estos ajustes óptimos o mantener tu configuración actual?
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-white/5">
            <Button 
              variant="default" 
              className="flex-1 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white border-0 shadow-[0_0_20px_rgba(var(--primary),0.3)] font-semibold h-12"
              onClick={handleApplyAndOperate}
            >
              Aplicar y Operar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-12 bg-transparent border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={handleIgnoreAndOperate}
            >
              <Play className="w-4 h-4 mr-2 opacity-50" />
              Mantener actual
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
