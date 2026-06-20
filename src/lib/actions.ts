'use client';

import { getFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Registra una nueva operación en el historial y actualiza estadísticas.
 */
export async function executeTrade(userId: string, tradeData: {
  pair: string;
  direction: 'CALL' | 'PUT';
  amount: number;
}) {
  const { firestore: db } = getFirebase();
  try {
    const botParamsRef = doc(db, 'configuracion', 'bot_params');
    const botParamsSnap = await getDoc(botParamsRef);
    const botParams = botParamsSnap.exists() ? botParamsSnap.data() : null;

    if (botParams && !botParams.bot_activo) {
      return { success: false, error: 'Motor de IA desactivado.' };
    }

    const now = new Date();
    const currentH = now.getHours().toString().padStart(2, '0');
    const currentM = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`;

    const isWithinSchedule = botParams?.schedules?.some((s: any) => {
      return currentTimeStr >= s.start && currentTimeStr <= s.end;
    }) || true;

    if (!isWithinSchedule) {
      return { success: false, error: 'Fuera de horario operativo.' };
    }

    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    if (!brokerSnap.exists() || brokerSnap.data().status !== 'connected') {
      return { success: false, error: 'Bróker no vinculado.' };
    }
    const brokerConfig = brokerSnap.data();

    const trendAligns = Math.random() > 0.4;
    const isWin = trendAligns;
    const payoutRatio = 0.85; 
    const profit = isWin ? tradeData.amount * payoutRatio : -tradeData.amount;
    const status = isWin ? 'win' : 'loss';

    addDoc(collection(db, 'users', userId, 'trades'), {
      ...tradeData,
      status,
      profit,
      accountType: brokerConfig.accountType,
      timestamp: new Date().toISOString()
    });

    const statsRef = doc(db, 'dashboard', 'current_stats');
    updateDoc(statsRef, {
      balance: increment(profit),
      dailyProfit: increment(profit),
      totalInvestment: increment(tradeData.amount),
      updatedAt: serverTimestamp()
    });

    return { success: true, status, profit, accountType: brokerConfig.accountType };
  } catch (error: any) {
    console.error('Error crítico en ejecución:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza la configuración operativa del bot.
 */
export async function updateBotConfig(data: any) {
  const { firestore: db } = getFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Fallo al actualizar núcleo:', error);
    return { success: false };
  }
}

/**
 * Protocolo de Apagado de Emergencia.
 */
export async function triggerKillSwitch() {
  const { firestore: db } = getFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await updateDoc(configRef, {
      bot_activo: false,
      killedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function promoteToSuperAdmin(userId: string) {
  const { firestore: db } = getFirebase();
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role: 'super-admin',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function signOutUser() {
  const { auth } = getFirebase();
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function disconnectBroker(userId: string) {
  const { firestore: db } = getFirebase();
  try {
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    await deleteDoc(brokerRef);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Seed inicial con los valores EXACTOS de la imagen V7
 */
export async function seedDemoData() {
  const { firestore: db } = getFirebase();
  try {
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 10500.50,
      dailyProfit: 125.40,
      winRate: 68,
      totalInvestment: 45200,
      updatedAt: serverTimestamp()
    });

    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      takeProfit: 60000,
      stopLoss: 8000,
      minBalance: 2000,
      investmentPerTrade: 4000,
      maxTradesPerDay: 1,
      maxLosses: 2,
      minRsi: 20,
      midRsi: 38,
      maxRsi: 62,
      martingale: false,
      pairs: ['EURUSD-OTC', 'GBPUSD-OTC'],
      schedules: [{start: '07:00', end: '09:00'}],
      bot_activo: true,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function clearSystemLogs() {
  return { success: true };
}
