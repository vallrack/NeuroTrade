'use client';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Bridge de Ejecución V7 (Traducción de iqInvest 7.0)
 * Simula la respuesta real del broker con la latencia configurada.
 */
async function processBrokerTrade(broker: string, amount: number, tradeData: any, botParams: any) {
  const latency = Math.floor(Math.random() * 70) + 80; 
  await new Promise(resolve => setTimeout(resolve, latency));

  const winProbability = 0.68; 
  const isWin = Math.random() < winProbability;
  const payoutRatio = 0.87; 
  
  const profit = isWin ? amount * payoutRatio : -amount;
  const status = isWin ? 'win' : 'loss';

  return { 
    success: true, 
    status, 
    profit: parseFloat(profit.toFixed(2)),
    latency: `${latency}ms`,
    executionTime: new Date().toISOString()
  };
}

function isSessionActive(schedules: {start: string, end: string}[]) {
  if (!schedules || schedules.length === 0) return true;
  const now = new Date();
  const currentHour = now.getHours();
  
  return schedules.some(s => {
    const start = parseInt(s.start);
    const end = parseInt(s.end);
    if (start <= end) {
      return currentHour >= start && currentHour < end;
    } else {
      return currentHour >= start || currentHour < end;
    }
  });
}

export async function executeTrade(userId: string, tradeData: {
  pair: string;
  direction: 'CALL' | 'PUT';
  amount: number;
}) {
  const { firestore: db } = initializeFirebase();
  try {
    const botParamsRef = doc(db, 'configuracion', 'bot_params');
    const botParamsSnap = await getDoc(botParamsRef);
    const botParams = botParamsSnap.exists() ? botParamsSnap.data() : null;

    if (!botParams || !botParams.bot_activo) return { success: false, error: 'Motor en STANDBY.' };
    if (!isSessionActive(botParams.schedules)) return { success: false, error: 'FUERA DE HORARIO.' };

    const statsRef = doc(db, 'users', userId, 'trading_stats', 'current');
    const statsSnap = await getDoc(statsRef);
    const currentStats = statsSnap.exists() ? statsSnap.data() : { balance: 11046.71, dailyProfit: 0 };
    
    if (botParams.minBalance && currentStats.balance < botParams.minBalance) {
      await updateDoc(botParamsRef, { bot_activo: false });
      return { success: false, error: 'BALANCE POR DEBAJO DEL MÍNIMO.' };
    }

    const tp = botParams.takeProfit || 60000;
    const peakPnl = botParams.peakPnl || 0;
    const dailyProfit = currentStats.dailyProfit || 0;

    if (dailyProfit > (tp * 0.3)) {
      const trailingStop = peakPnl * 0.65;
      if (dailyProfit <= trailingStop && dailyProfit > 0) {
        await updateDoc(botParamsRef, { bot_activo: false });
        return { success: false, error: '🛡️ TRAILING STOP ACTIVADO.' };
      }
    }

    let finalAmount = tradeData.amount;
    if (botParams.riskMode === 'Martingala' && botParams.lastTradeStatus === 'loss') {
      finalAmount = tradeData.amount * 2.2; 
    } else if (botParams.riskMode === 'Interés Compuesto' && dailyProfit > 0) {
      finalAmount = tradeData.amount + (dailyProfit * 0.1); 
    }

    const execution = await processBrokerTrade('IQ Option', finalAmount, tradeData, botParams);

    if (execution.success) {
      const timestamp = new Date().toISOString();
      
      await addDoc(collection(db, 'users', userId, 'trades'), {
        ...tradeData,
        amount: finalAmount,
        status: execution.status,
        profit: execution.profit,
        timestamp,
        latency: execution.latency
      });

      const newPeak = Math.max(peakPnl, dailyProfit + execution.profit);
      await updateDoc(statsRef, {
        balance: increment(execution.profit),
        dailyProfit: increment(execution.profit),
        totalInvestment: increment(finalAmount),
        tradesCount: increment(1),
        winsCount: increment(execution.status === 'win' ? 1 : 0)
      });

      await updateDoc(botParamsRef, {
        lastTradeStatus: execution.status,
        peakPnl: newPeak,
        updatedAt: serverTimestamp()
      });

      return execution;
    }

    return { success: false, error: 'Error en Bridge.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBotConfig(data: any) {
  const { firestore: db } = initializeFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function triggerKillSwitch() {
  const { firestore: db } = initializeFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await updateDoc(configRef, { bot_activo: false });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function promoteToSuperAdmin(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await setDoc(doc(db, 'users', userId), { role: 'super-admin' }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function signOutUser() {
  const { auth } = initializeFirebase();
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Carga los valores reales detectados en la imagen proporcionada por el usuario.
 * Saldo Práctica: $11,046.71
 */
export async function seedDemoData(userId?: string) {
  const { firestore: db } = initializeFirebase();
  try {
    if (userId) {
      const statsRef = doc(db, 'users', userId, 'trading_stats', 'current');
      await setDoc(statsRef, {
        balance: 11046.71,
        dailyProfit: 0.00,
        winRate: 0,
        totalInvestment: 0,
        tradesCount: 0,
        winsCount: 0,
        lastSync: new Date().toISOString()
      }, { merge: true });
    }

    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      takeProfit: 60000,
      stopLoss: 8000,
      minBalance: 2000,
      investmentPerTrade: 4000,
      maxTradesPerDay: 20,
      minRsi: 20,
      midRsi: 38,
      maxRsi: 62,
      riskMode: 'Fijo',
      bot_activo: true,
      pairs: ['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD'],
      schedules: [{start: '07', end: '23'}]
    });

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function clearSystemLogs() {
  return { success: true };
}

export async function disconnectBroker(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await deleteDoc(doc(db, 'users', userId, 'config', 'broker'));
    const statsRef = doc(db, 'users', userId, 'trading_stats', 'current');
    await updateDoc(statsRef, { balance: 0, dailyProfit: 0 });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
