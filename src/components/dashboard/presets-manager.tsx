'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Crosshair, TrendingUp, AlertTriangle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PresetsManager() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { isRunning, toggleEngine } = useBotEngine();
  
  const uiSettingsRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'ui_settings');
  }, [user, firestore]);
  
  const { data: uiSettings } = useDoc(uiSettingsRef);
  
  const [loadingPhase, setLoadingPhase] = useState<number | null>(null);
  const [accountType, setAccountType] = useState<'real' | 'demo'>('real');
  
  // Sincronizar preferencia guardada al iniciar sesión
  useEffect(() => {
    if (uiSettings?.presetAccountType) {
      setAccountType(uiSettings.presetAccountType);
    }
  }, [uiSettings?.presetAccountType]);

  const handleAccountTypeChange = async (type: 'real' | 'demo') => {
    setAccountType(type);
    if (user && firestore) {
      try {
        const ref = doc(firestore, 'users', user.uid, 'config', 'ui_settings');
        await setDoc(ref, { presetAccountType: type }, { merge: true });
      } catch (e) {
        console.error("Error guardando preferencia:", e);
      }
    }
  };

  // Estados para el Modal de Vista Previa
  const [previewPhase, setPreviewPhase] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const openPreview = (phaseNumber: number) => {
    let presetData: any = {};

    if (phaseNumber === 1) {
      // Fase 1: Contrariana (Días 1-5)
      presetData = {
        reverseMode: 'always',
        moneyManagementMode: 'martingale',
        investmentPerTrade: accountType === 'real' ? 5000 : 10,
        martingaleMultiplier: 2.1,
        maxLosses: 2,
        min_confidence_score: 70,
        strategy_mode: 'aggressive',
        planPhase: 1,
        planDay: 1,
        dailyGoalPercent: 60,
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
        investmentPerTrade: accountType === 'real' ? 10000 : 50,
        min_confidence_score: 75,
        strategy_mode: 'balanced',
        planPhase: 2,
        planDay: 6,
        dailyGoalPercent: 60,
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
        planPhase: 3,
        planDay: 11,
        dailyGoalPercent: 60,
        autopilot: {
          enabled: true,
          autoConnectBridge: true,
          pairMode: 'auto',
          scheduleMode: 'auto',
          slots: []
        }
      };
    }
    
    setPreviewData(presetData);
    setPreviewPhase(phaseNumber);
  };

  const confirmAndApplyPreset = async () => {
    if (!user || !firestore || !previewData || previewPhase === null) {
      toast({ title: 'Error', description: 'No conectado a la base de datos o datos no válidos.', variant: 'destructive' });
      return;
    }

    setLoadingPhase(previewPhase);
    const botParamsRef = doc(firestore, 'users', user.uid, 'config', 'bot_params');

    try {
      await setDoc(botParamsRef, { ...previewData, updatedAt: new Date().toISOString() }, { merge: true });
      toast({
        title: `✅ FASE ${previewPhase} CARGADA`,
        description: 'El bot ha sido reconfigurado y está listo para operar.',
      });
      setPreviewPhase(null);
      
      // Si el bot no está corriendo, encenderlo
      if (!isRunning) {
        toggleEngine();
      }
      
      // Redirigir a la pestaña del Broker para conectar la cuenta
      router.push('/dashboard/broker');
      
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
    <>
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
                onClick={() => handleAccountTypeChange('real')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${accountType === 'real' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-white'}`}
              >
                Real (COP)
              </button>
              <button 
                onClick={() => handleAccountTypeChange('demo')}
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
                Días 1 al 5. Modo siempre inverso, martingala activa, capital {accountType === 'real' ? '$5,000 COP' : '$10 USD'}, caza manipulación OTC.
              </p>
              <Button 
                onClick={() => openPreview(1)}
                disabled={loadingPhase !== null}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {loadingPhase === 1 ? 'Cargando...' : 'Previsualizar Fase 1'}
              </Button>
            </div>

            {/* FASE 2 */}
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all">
              <div className="flex items-center gap-2 text-blue-500 font-bold">
                <TrendingUp className="h-5 w-5" />
                Fase 2: Tendencial
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Días 6 al 10. Bot Normal, operando a favor de tendencia, interés fijo {accountType === 'real' ? '$10,000 COP' : '$50 USD'}, modo auto.
              </p>
              <Button 
                onClick={() => openPreview(2)}
                disabled={loadingPhase !== null}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {loadingPhase === 2 ? 'Cargando...' : 'Previsualizar Fase 2'}
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
                onClick={() => openPreview(3)}
                disabled={loadingPhase !== null}
                className="w-full bg-amber-600 hover:bg-amber-700 text-amber-950 font-bold"
              >
                {loadingPhase === 3 ? 'Cargando...' : 'Previsualizar Fase 3'}
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* MODAL DE PREVISUALIZACIÓN */}
      <Dialog open={previewPhase !== null} onOpenChange={(open) => { if (!open) setPreviewPhase(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Confirmar Fase {previewPhase}</DialogTitle>
            <DialogDescription>
              Ajusta los valores antes de enviarlos al bot. {accountType === 'real' ? '(Cuenta COP)' : '(Cuenta USD)'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 p-3 rounded-md text-sm mt-2 font-medium">
            ⚠️ <strong>Advertencia de Riesgo:</strong> Estás a punto de sobreescribir la configuración del bot con los valores predeterminados del manual. Al hacer clic en "Aplicar al Bot", confirmas que aceptas los parámetros y los riesgos operativos de esta Fase.
          </div>
          
          {previewData && (
            <div className="grid gap-4 py-4">
              
              <div className="bg-slate-900/50 p-3 rounded-md border border-white/5 text-xs text-muted-foreground space-y-2">
                <p><strong>1. Tipo de Interés:</strong> {previewData.moneyManagementMode === 'martingale' ? 'Interés Compuesto' : 'Interés Fijo'}</p>
                <p><strong>2. Uso de Martingala:</strong> {previewData.moneyManagementMode === 'martingale' ? 'Activado (Max 2 niveles)' : 'Apagado (Cero martingala)'}</p>
                <p><strong>3. Modo de Estrategia:</strong> {previewData.reverseMode === 'always' ? '"Siempre Inverso" (Filtros Anti-OTC)' : previewData.reverseMode === 'none' ? 'Normal (Balanceado)' : 'Inteligente (Precisión Quirúrgica)'}</p>
                <p><strong>4. Progresión de Meta:</strong> {previewPhase === 1 ? 'Día 1 (60%) al Día 5 (100%)' : previewPhase === 2 ? 'Día 6 (60%) al Día 10 (100%)' : 'Día 11 (60%) al Día 15 (100%)'}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="investment">Inversión por Trade</Label>
                <Input 
                  id="investment"
                  type="number" 
                  value={previewData.investmentPerTrade}
                  onChange={(e) => setPreviewData({...previewData, investmentPerTrade: Number(e.target.value)})}
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confidence">Confianza Mínima de la IA (%)</Label>
                <Input 
                  id="confidence"
                  type="number" 
                  value={previewData.min_confidence_score}
                  onChange={(e) => setPreviewData({...previewData, min_confidence_score: Number(e.target.value)})}
                  className="bg-background"
                />
              </div>
              {previewData.moneyManagementMode === 'martingale' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="martingale">Multiplicador Martingala</Label>
                  <Input 
                    id="martingale"
                    type="number" 
                    step="0.1"
                    value={previewData.martingaleMultiplier || 1}
                    onChange={(e) => setPreviewData({...previewData, martingaleMultiplier: Number(e.target.value)})}
                    className="bg-background"
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewPhase(null)}>Cancelar</Button>
            <Button onClick={confirmAndApplyPreset} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Aplicar al Bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
