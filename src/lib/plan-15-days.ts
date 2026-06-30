export function getPresetForDay(day: number, accountType: 'real' | 'demo') {
  let presetData: any = {};
  
  // Determinar la fase en base al día
  const phaseNumber = day <= 5 ? 1 : day <= 10 ? 2 : 3;
  
  // Calcular la meta diaria (aumenta 10% cada día dentro de la fase)
  // Día 1=60%, Día 2=70%, Día 3=80%, Día 4=90%, Día 5=100%
  const dayInPhase = day <= 5 ? day : day <= 10 ? day - 5 : day - 10;
  const dailyGoalPercent = 60 + (dayInPhase - 1) * 10;

  if (phaseNumber === 1) {
    presetData = {
      reverseMode: 'always',
      moneyManagementMode: 'martingale',
      investmentPerTrade: accountType === 'real' ? 2000 : 10,
      martingaleMultiplier: 2.1,
      maxLosses: 3, // FIX #6: Aumentado de 2→3 para dar más margen antes de pausar
      min_confidence_score: 70,
      strategy_mode: 'aggressive',
      autopilot: {
        enabled: true,
        autoConnectBridge: true,
        pairMode: 'manual',
        scheduleMode: 'auto',
        slots: []
      },
    };
  } else if (phaseNumber === 2) {
    presetData = {
      reverseMode: 'none',
      moneyManagementMode: 'fixed',
      investmentPerTrade: accountType === 'real' ? 4000 : 50,
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
    presetData = {
      reverseMode: 'auto',
      moneyManagementMode: 'fixed',
      investmentPerTrade: accountType === 'real' ? 8000 : 200,
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
  
  return {
    ...presetData,
    planPhase: phaseNumber,
    planDay: day,
    dailyGoalPercent
  };
}
