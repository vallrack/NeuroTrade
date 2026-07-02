'use client';

import { useState, useEffect } from 'react';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  evaluateStrategy,
  getStrategyLabel,
  getSignalColor,
  getSignalBg,
  getSignalEmoji,
  type StrategyAdvice,
  type TradeRecord,
} from '@/lib/ai-strategy-advisor';
import { BrainCircuit, ChevronUp, ChevronDown, Minus } from 'lucide-react';

interface StrategyAdvisorBadgeProps {
  botParams?: any;
  className?: string;
}

export function StrategyAdvisorBadge({ botParams, className = '' }: StrategyAdvisorBadgeProps) {
  const { recentTrades, isRunning } = useBotEngine();
  const { user } = useUser();
  const firestore = useFirestore();

  const [advice, setAdvice] = useState<StrategyAdvice | null>(null);
  const [lastEvalCount, setLastEvalCount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Re-evaluar cada 10 operaciones nuevas
  useEffect(() => {
    const totalTrades = recentTrades.length;

    // Evaluar al inicio o cada 10 ops
    if (totalTrades === 0) return;
    if (totalTrades === lastEvalCount) return;
    if (totalTrades % 10 !== 0 && lastEvalCount !== 0) return;

    const tradesForAdvisor: TradeRecord[] = recentTrades.map((t: any) => ({
      status: t.status as 'win' | 'loss' | 'tie',
      amount: t.amount ?? 0,
      profit: t.profit ?? 0,
      timestamp: t.timestamp,
    }));

    const newAdvice = evaluateStrategy(tradesForAdvisor, botParams, 10);
    setAdvice(newAdvice);
    setLastEvalCount(totalTrades);

    // Disparar evento global para que el modal de IA también lo reciba
    window.dispatchEvent(new CustomEvent('nt_strategy_advice', { detail: newAdvice }));
  }, [recentTrades.length, botParams, lastEvalCount]);

  // Aplicar la recomendación manualmente desde el badge
  const handleApply = async () => {
    if (!advice || !user || !firestore) return;
    if (advice.mode === 'pause') return; // Pausa no se "aplica", se muestra la advertencia

    setIsApplying(true);
    try {
      const botParamsDoc = doc(firestore, 'users', user.uid, 'config', 'bot_params');
      const update: Record<string, any> = {};

      // Si no hay plan activo, cambiar el modo de gestión
      if (!advice.hasActivePlan) {
        update.moneyManagementMode = advice.mode;
      }

      // Siempre actualizar la meta si hay sugerencia
      if (advice.suggestedGoalPercent !== null) {
        update.dailyGoalPercent = advice.suggestedGoalPercent;
      }

      if (Object.keys(update).length > 0) {
        await setDoc(botParamsDoc, update, { merge: true });
      }
    } catch (err) {
      console.error('[StrategyAdvisorBadge] Error aplicando recomendación:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!advice) return null;

  const signalColor  = getSignalColor(advice.signal);
  const signalBg     = getSignalBg(advice.signal);
  const signalEmoji  = getSignalEmoji(advice.signal);
  const strategyLabel = getStrategyLabel(advice.mode);

  const SignalIcon =
    advice.signal === 'bullish' ? ChevronUp :
    advice.signal === 'bearish' ? ChevronDown : Minus;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${signalBg} backdrop-blur-sm ${className}`}>
      {/* Icono IA */}
      <BrainCircuit className={`w-3.5 h-3.5 shrink-0 ${signalColor}`} />

      {/* Info principal */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <span className="text-slate-400">Consejo IA:</span>
        <span className={`font-bold ${signalColor}`}>
          {signalEmoji} {strategyLabel}
        </span>
        {advice.winRate !== null && (
          <span className="text-slate-500">
            ({advice.winRate}% win)
          </span>
        )}
      </div>

      {/* Señal arrow */}
      <SignalIcon className={`w-3 h-3 shrink-0 ${signalColor}`} />

      {/* Botón aplicar (si no hay plan activo y la señal no es "pause") */}
      {!advice.hasActivePlan && advice.mode !== 'pause' && isRunning && (
        <button
          onClick={handleApply}
          disabled={isApplying}
          className={`ml-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all border ${signalBg} ${signalColor} hover:opacity-80 disabled:opacity-40`}
        >
          {isApplying ? '...' : 'APLICAR'}
        </button>
      )}
    </div>
  );
}
