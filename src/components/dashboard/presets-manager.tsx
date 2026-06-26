'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Crosshair, TrendingUp, AlertTriangle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export function PresetsManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loadingPhase, setLoadingPhase] = useState<number | null>(null);
  const [accountType, setAccountType] = useState<'real' | 'demo'>('real');

  const applyPreset = async (phaseNumber: number) => {
    if (!user || !firestore) {
      toast({ title: 'Error', description: 'No conectado a la base de datos.', variant: 'destructive' });
      return;
    }

    setLoadingPhase(phaseNumber);
    const botParamsRef = doc(firestore, 'users', user.uid, 'config', 'bot_params');

    let presetData: any = {};

    if (phaseNumber === 1) {
      // Fase 1: Contrariana (Días 1-5)
      presetData = {
        reverseMode: 'always',
        moneyManagementMode: 'martingale',
        investmentPerTrade: accountType === 'real' ? 5000 : 50,
        martingaleMultiplier: 2.1,
        maxLosses: 2,
        min_confidence_score: 70,
        strategy_mode: 'aggressive',
        autopilot: {
          enabled: true,
          autoConnectBridge: true,
          pairMode: 'manual',
          scheduleMode: 'auto',
          slots: []
        },
        pairs: ['EURUSD-OTC', 'GBPUSD-OTC'], // Enfocado en OTC
      };
    } else if (phaseNumber === 2) {
      // Fase 2: Normal Tendencial (Días 6-10)
      presetData = {
        reverseMode: 'none',
        moneyManagementMode: 'fixed',
        investmentPerTrade: accountType === 'real' ? 10000 : 100,
        min_confidence_score: 75,
        strategy_mode: 'balanced',
        autopilot: {
          enabled: true,
          autoConnectBridge: true,
          pairMode: 'auto',
          scheduleMode: 'auto',
          slots: []
        }
      };
    } else if (phaseNumber === 3) {
      // Fase 3: IA Francotirador (Días 11-15)
      presetData = {
        reverseMode: 'auto', // Reverso solo en trampas
        moneyManagementMode: 'fixed',
        investmentPerTrade: accountType === 'real' ? 20000 : 200,
        min_confidence_score: 78,
        strategy_mode: 'conservative',
        autopilot: {
          enabled: true,
          autoConnectBridge: true,
          pairMode: 'auto',
          scheduleMode: 'auto',
          slots: []
        }
      };
    }

    try {
      await setDoc(botParamsRef, { ...presetData, updatedAt: new Date().toISOString() }, { merge: true });
      toast({
        title: `✅ FASE ${phaseNumber} CARGADA`,
        description: 'El bot ha sido reconfigurado en tiempo real con la nueva estrategia.',
      });
    } catch (error: any) {
      console.error('Error aplicando preset:', error);
      toast({
        title: 'Error al cargar estrategia',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingPhase(null);
    }
  };

  return (
    <Card className="bg-card/50 border-white/5 backdrop-blur-xl mb-8 border-primary/20 shadow-[0_0_15px_rgba(38,166,154,0.1)]">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-5 w-5 text-primary" />
              Carga Rápida de Estrategias (Plan 15 Días)
            </CardTitle>
            <CardDescription>
              Sobreescribe la configuración actual instantáneamente. Los valores se ajustarán al tipo de cuenta seleccionado.
            </CardDescription>
          </div>
          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/10 shrink-0">
            <button 
              onClick={() => setAccountType('real')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${accountType === 'real' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-white'}`}
            >
              Real (COP)
            </button>
            <button 
              onClick={() => setAccountType('demo')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${accountType === 'demo' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-white'}`}
            >
              Demo (USD)
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* FASE 1 */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 transition-all">
            <div className="flex items-center gap-2 text-rose-500 font-bold">
              <AlertTriangle className="h-5 w-5" />
              Fase 1: Contrariana
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Días 1 al 5. Modo siempre inverso, martingala activa, capital {accountType === 'real' ? '$5,000 COP' : '$50 USD'}, caza manipulación OTC.
            </p>
            <Button 
              onClick={() => applyPreset(1)}
              disabled={loadingPhase !== null}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {loadingPhase === 1 ? 'Cargando...' : 'Cargar Fase 1'}
            </Button>
          </div>

          {/* FASE 2 */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all">
            <div className="flex items-center gap-2 text-blue-500 font-bold">
              <TrendingUp className="h-5 w-5" />
              Fase 2: Tendencial
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Días 6 al 10. Bot Normal, operando a favor de tendencia, interés fijo {accountType === 'real' ? '$10,000 COP' : '$100 USD'}, modo auto.
            </p>
            <Button 
              onClick={() => applyPreset(2)}
              disabled={loadingPhase !== null}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {loadingPhase === 2 ? 'Cargando...' : 'Cargar Fase 2'}
            </Button>
          </div>

          {/* FASE 3 */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <Crosshair className="h-5 w-5" />
              Fase 3: Inteligente
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Días 11 al 15. Precisión quirúrgica (IA al 78%), interés fijo agresivo {accountType === 'real' ? '($20,000 COP)' : '($200 USD)'}, cero martingala.
            </p>
            <Button 
              onClick={() => applyPreset(3)}
              disabled={loadingPhase !== null}
              className="w-full bg-amber-600 hover:bg-amber-700 text-amber-950 font-bold"
            >
              {loadingPhase === 3 ? 'Cargando...' : 'Cargar Fase 3'}
            </Button>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
