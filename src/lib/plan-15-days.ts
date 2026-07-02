export function getPresetForDay(day: number, accountType: 'real' | 'demo', brokerType: string = 'iqoption') {
  let presetData: any = {};
  
  // Determinar la fase en base al día
  const phaseNumber = day <= 5 ? 1 : day <= 10 ? 2 : 3;
  
  // Calcular la meta diaria
  const dayInPhase = day <= 5 ? day : day <= 10 ? day - 5 : day - 10;
  const dailyGoalPercent = 60 + (dayInPhase - 1) * 10;

  // Montos base cambian según el broker
  // Binance y otros brokers usan USD para real, min $10
  // IQ Option COP usa min $2000 COP
  const isCrypto = brokerType === 'binance' || brokerType === 'alpaca';
  const minRealInvestment = isCrypto ? 10 : 2000;
  const midRealInvestment = isCrypto ? 25 : 4000;
  const maxRealInvestment = isCrypto ? 50 : 8000;

  if (phaseNumber === 1) {
    presetData = {
      reverseMode: 'always',
      moneyManagementMode: 'martingale',
      investmentPerTrade: accountType === 'real' ? minRealInvestment : 10,
      martingaleMultiplier: 2.1,
      maxLosses: 3, 
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
      investmentPerTrade: accountType === 'real' ? midRealInvestment : 50,
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
      investmentPerTrade: accountType === 'real' ? maxRealInvestment : 200,
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
