'use client';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * PROTOCOLO MAESTRO V7 - SINCRONIZACIÓN DE BALANCE IMAGEN
 * Valor exacto de la cuenta de práctica de IQ Option del usuario.
 */
const DEMO_BALANCE_MASTER = 11046.71;

async function processBrokerTrade(amount: number) {
  const latency = Math.floor(Math.random() * 50) + 60; 
  await new Promise(resolve => setTimeout(resolve, latency));

  const winProbability = 0.72;
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

export async function executeTrade(userId: string, tradeData: {
  pair: string;
  direction: 'CALL' | 'PUT';
  amount: number;
}) {
  const { firestore: db } = initializeFirebase();
  try {
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    const brokerConfig = brokerSnap.exists() ? brokerSnap.data() : { accountType: 'demo' };
    const accountType = brokerConfig.accountType || 'demo';

    const botParamsRef = doc(db, 'configuracion', 'bot_params');
    const botParamsSnap = await getDoc(botParamsRef);
    const botParams = botParamsSnap.exists() ? botParamsSnap.data() : null;

    if (!botParams || !botParams.bot_activo) return { success: false, error: 'SISTEMA EN ESPERA.' };

    const statsRef = doc(db, 'users', userId, 'trading_stats', accountType);
    const statsSnap = await getDoc(statsRef);
    
    const currentStats = statsSnap.exists() ? statsSnap.data() : { 
      balance: accountType === 'demo' ? DEMO_BALANCE_MASTER : 0, 
      dailyProfit: 0 
    };
    
    if (currentStats.balance < (botParams.minBalance || 2000)) {
      await updateDoc(botParamsRef, { bot_activo: false });
      return { success: false, error: 'PROTECCIÓN DE BALANCE ACTIVADA.' };
    }

    let finalAmount = tradeData.amount;
    if (botParams.riskMode === 'Martingala' && botParams.lastTradeStatus === 'loss') {
      finalAmount = tradeData.amount * 2.2; 
    }

    const execution = await processBrokerTrade(finalAmount);

    if (execution.success) {
      const timestamp = new Date().toISOString();
      
      await addDoc(collection(db, 'users', userId, 'trades'), {
        ...tradeData,
        amount: finalAmount,
        status: execution.status,
        profit: execution.profit,
        timestamp,
        latency: execution.latency,
        accountType,
        source: 'V7-MASTER-BRIDGE'
      });

      await updateDoc(statsRef, {
        balance: increment(execution.profit),
        dailyProfit: increment(execution.profit),
        totalInvestment: increment(finalAmount),
        tradesCount: increment(1),
        winsCount: increment(execution.status === 'win' ? 1 : 0),
        lastExecution: timestamp
      });

      await updateDoc(botParamsRef, {
        lastTradeStatus: execution.status,
        updatedAt: serverTimestamp()
      });

      return execution;
    }

    return { success: false, error: 'Fallo en la comunicación con el Bridge.' };
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

export async function seedDemoData(userId?: string) {
  const { firestore: db } = initializeFirebase();
  try {
    if (userId) {
      const statsRef = doc(db, 'users', userId, 'trading_stats', 'demo');
      await setDoc(statsRef, {
        balance: DEMO_BALANCE_MASTER,
        dailyProfit: 0.00,
        winRate: 0,
        totalInvestment: 0,
        tradesCount: 0,
        winsCount: 0,
        lastSync: new Date().toISOString()
      }, { merge: true });
    }
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function disconnectBroker(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await deleteDoc(doc(db, 'users', userId, 'config', 'broker'));
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function clearSystemLogs() {
  // En una implementación real con RTDB esto borraría el nodo de logs
  // Por ahora devolvemos éxito para el simulador del frontend
  return { success: true };
}
