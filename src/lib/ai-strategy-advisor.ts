/**
 * ai-strategy-advisor.ts — Consejo IA Autónomo
 *
 * Lógica central que analiza el rendimiento reciente (últimas 10 operaciones)
 * y decide automáticamente qué estrategia de gestión de capital es la óptima:
 *
 *  - 'compound'   → racha ganadora: win rate ≥ 65%
 *  - 'fixed'      → rendimiento neutro: win rate 50-64%
 *  - 'martingale' → racha perdedora leve: win rate 35-49%
 *  - 'pause'      → racha perdedora fuerte: win rate < 35%
 *
 * REGLA CLAVE: Si hay un Plan de 15 Días activo, el Consejo NUNCA cambia
 * el modo de la fase. Solo puede sugerir ajustar la meta diaria.
 */

export type StrategyMode = 'fixed' | 'compound' | 'martingale' | 'pause';
export type StrategySignal = 'bullish' | 'neutral' | 'recovery' | 'bearish';

export interface StrategyAdvice {
  mode: StrategyMode;
  winRate: number | null;
  signal: StrategySignal;
  reasoning: string;
  /** Número de operaciones analizadas */
  sampleSize: number;
  /** Si hay plan activo, el Consejo solo recomienda; no fuerza cambios de modo */
  hasActivePlan: boolean;
  /** Nueva meta diaria sugerida por la IA (si corresponde) */
  suggestedGoalPercent: number | null;
}

export interface TradeRecord {
  status: 'win' | 'loss' | 'tie';
  amount: number;
  profit?: number;
  timestamp?: string;
  accountType?: string;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Evalúa el rendimiento reciente y genera una recomendación de estrategia.
 *
 * @param recentTrades  Historial de trades (ordenado del más reciente al más antiguo)
 * @param currentParams Parámetros actuales del bot (para detectar si hay plan activo)
 * @param windowSize    Número de operaciones a analizar (default: 10)
 */
export function evaluateStrategy(
  recentTrades: TradeRecord[],
  currentParams?: Record<string, any>,
  windowSize = 10
): StrategyAdvice {
  const hasActivePlan = !!(currentParams?.planPhase && currentParams?.planDay);

  if (!recentTrades || recentTrades.length < 5) {
    return {
      mode: 'fixed',
      winRate: null,
      signal: 'neutral',
      reasoning: 'Historial insuficiente (< 5 operaciones). Operando en modo fijo por seguridad.',
      sampleSize: recentTrades?.length ?? 0,
      hasActivePlan,
      suggestedGoalPercent: null,
    };
  }

  // Analizar solo la ventana más reciente
  const window = recentTrades.slice(0, windowSize);
  const wins   = window.filter(t => t.status === 'win').length;
  const losses = window.filter(t => t.status === 'loss').length;
  const total  = window.length;
  const winRate = Math.round((wins / total) * 1000) / 10; // 1 decimal

  // Calcular meta sugerida basada en el win rate
  let suggestedGoalPercent: number | null = null;
  if (winRate >= 65) {
    suggestedGoalPercent = 30; // mercado favorable → meta ambiciosa
  } else if (winRate >= 50) {
    suggestedGoalPercent = 20; // mercado neutral → meta moderada
  } else if (winRate >= 35) {
    suggestedGoalPercent = 15; // mercado adverso → meta conservadora
  } else {
    suggestedGoalPercent = null; // no operar
  }

  // Si hay plan activo: respetar la meta del plan (no sugerir más de plan+5)
  if (hasActivePlan && currentParams?.dailyGoalPercent && suggestedGoalPercent !== null) {
    const planGoal = currentParams.dailyGoalPercent as number;
    suggestedGoalPercent = Math.min(suggestedGoalPercent, planGoal + 5);
  }

  if (winRate >= 65) {
    return {
      mode: hasActivePlan ? (currentParams?.moneyManagementMode ?? 'fixed') : 'compound',
      winRate,
      signal: 'bullish',
      reasoning: `Racha GANADORA detectada (${winRate}% éxito en últimas ${total} ops, ${wins}W/${losses}L). ` +
                 (hasActivePlan
                   ? `Plan activo en fase ${currentParams!.planPhase}: modo ${currentParams!.moneyManagementMode} se mantiene.`
                   : `Modo compuesto recomendado para capitalizar el momentum.`),
      sampleSize: total,
      hasActivePlan,
      suggestedGoalPercent,
    };
  }

  if (winRate >= 50) {
    return {
      mode: hasActivePlan ? (currentParams?.moneyManagementMode ?? 'fixed') : 'fixed',
      winRate,
      signal: 'neutral',
      reasoning: `Rendimiento NEUTRAL (${winRate}% éxito en últimas ${total} ops, ${wins}W/${losses}L). ` +
                 `Modo fijo para estabilidad y conservación de capital.`,
      sampleSize: total,
      hasActivePlan,
      suggestedGoalPercent,
    };
  }

  if (winRate >= 35) {
    return {
      mode: hasActivePlan ? (currentParams?.moneyManagementMode ?? 'fixed') : 'martingale',
      winRate,
      signal: 'recovery',
      reasoning: `Racha perdedora LEVE (${winRate}% éxito en últimas ${total} ops, ${wins}W/${losses}L). ` +
                 (hasActivePlan
                   ? `Plan activo en fase ${currentParams!.planPhase}: modo ${currentParams!.moneyManagementMode} se mantiene.`
                   : `Martingala (máx 2 niveles) para recuperar pérdidas de forma controlada.`),
      sampleSize: total,
      hasActivePlan,
      suggestedGoalPercent,
    };
  }

  // Win rate < 35% → recomendación de pausa
  return {
    mode: 'pause',
    winRate,
    signal: 'bearish',
    reasoning: `Racha perdedora FUERTE (${winRate}% éxito en últimas ${total} ops, ${wins}W/${losses}L). ` +
               `Se recomienda PAUSAR el motor hasta que el mercado mejore.`,
    sampleSize: total,
    hasActivePlan,
    suggestedGoalPercent: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve un label corto y amigable para mostrar en la UI */
export function getStrategyLabel(mode: StrategyMode): string {
  const labels: Record<StrategyMode, string> = {
    fixed:      'Interés Fijo',
    compound:   'Interés Compuesto',
    martingale: 'Martingala',
    pause:      'Pausa Recomendada',
  };
  return labels[mode] ?? mode;
}

/** Devuelve el color (clase Tailwind) asociado al signal */
export function getSignalColor(signal: StrategySignal): string {
  const colors: Record<StrategySignal, string> = {
    bullish:  'text-emerald-400',
    neutral:  'text-amber-400',
    recovery: 'text-blue-400',
    bearish:  'text-rose-400',
  };
  return colors[signal] ?? 'text-slate-400';
}

/** Devuelve el color de fondo (clase Tailwind) asociado al signal */
export function getSignalBg(signal: StrategySignal): string {
  const bgs: Record<StrategySignal, string> = {
    bullish:  'bg-emerald-500/10 border-emerald-500/20',
    neutral:  'bg-amber-500/10 border-amber-500/20',
    recovery: 'bg-blue-500/10 border-blue-500/20',
    bearish:  'bg-rose-500/10 border-rose-500/20',
  };
  return bgs[signal] ?? 'bg-slate-500/10 border-slate-500/20';
}

/** Icono emoji asociado al signal */
export function getSignalEmoji(signal: StrategySignal): string {
  const emojis: Record<StrategySignal, string> = {
    bullish:  '🚀',
    neutral:  '⚖️',
    recovery: '🔄',
    bearish:  '⛔',
  };
  return emojis[signal] ?? '❓';
}
