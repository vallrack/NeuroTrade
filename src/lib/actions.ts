'use client';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Capa de Abstracción de Bróker (Bridge V7).
 * Simula la respuesta de ejecución HFT tras el login v2 y apertura de WebSocket.
 * Aquí es donde traduciremos tu lógica de conexión de Python.
 */
async function processBrokerTrade(broker: string, credentials: any, tradeData: any) {
  // Simulación de latencia de red WSS real (80ms - 150ms)
  const latency = Math.floor(Math.random() * 70) + 80; 
  await new Promise(resolve => setTimeout(resolve, latency));

  // Algoritmo de probabilidad V7: En un bot real, esto vendría del resultado del broker
  const winProbability = 0.65; 
  const isWin = Math.random() < winProbability;
  const payoutRatio = 0.87; 
  const profit = isWin ? tradeData.amount * payoutRatio : -tradeData.amount;
  const status = isWin ? 'win' : 'loss';

  return { 
    success: true, 
    status, 
    profit: parseFloat(profit.toFixed(2)),
    latency: `${latency}ms`,
    executionTime: new Date().toISOString()
  };
}

/**
 * Registra una nueva operación y actualiza todo el ecosistema de estadísticas.
 */
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

    if (botParams && !botParams.bot_activo) {
      return { success: false, error: 'Motor de IA en STANDBY.' };
    }

    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    if (!brokerSnap.exists() || brokerSnap.data().status !== 'connected') {
      return { success: false, error: 'Túnel de Bróker no establecido.' };
    }
    
    const brokerConfig = brokerSnap.data();

    // Ejecución a través del Bridge Cuántico
    const execution = await processBrokerTrade(brokerConfig.provider, brokerConfig, tradeData);

    if (execution.success) {
      const timestamp = new Date().toISOString();
      const dateId = timestamp.split('T')[0].replace(/-/g, '');

      // 1. Guardar trade en historial de usuario
      await addDoc(collection(db, 'users', userId, 'trades'), {
        ...tradeData,
        status: execution.status,
        profit: execution.profit,
        accountType: brokerConfig.accountType,
        broker: brokerConfig.provider,
        latency: execution.latency,
        timestamp
      });

      // 2. Actualizar estadísticas globales del Dashboard
      const statsRef = doc(db, 'dashboard', 'current_stats');
      const statsSnap = await getDoc(statsRef);
      const currentStats = statsSnap.exists() ? statsSnap.data() : { winRate: 0, totalTrades: 0, wins: 0, balance: 10000 };
      
      const newTotalTrades = (currentStats.totalTrades || 0) + 1;
      const newWins = (currentStats.wins || 0) + (execution.status === 'win' ? 1 : 0);
      const newWinRate = Math.round((newWins / newTotalTrades) * 100);

      await updateDoc(statsRef, {
        balance: increment(execution.profit),
        dailyProfit: increment(execution.profit),
        totalInvestment: increment(tradeData.amount),
        totalTrades: newTotalTrades,
        wins: newWins,
        winRate: newWinRate,
        updatedAt: serverTimestamp()
      });

      // 3. Actualizar registro de equidad diaria
      const equityRef = doc(db, 'rendimiento_diario', dateId);
      const equitySnap = await getDoc(equityRef);
      if (equitySnap.exists()) {
        await updateDoc(equityRef, { equity: increment(execution.profit) });
      } else {
        const currentBalance = currentStats.balance || 10000;
        await setDoc(equityRef, { date: timestamp.split('T')[0], equity: currentBalance + execution.profit });
      }

      return { ...execution, accountType: brokerConfig.accountType };
    }

    return { success: false, error: 'Fallo crítico en túnel buyV3.' };
  } catch (error: any) {
    console.error('Error en ejecución V7:', error);
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
  const { firestore: db } = initializeFirebase();
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
  const { auth } = initializeFirebase();
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function disconnectBroker(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    await deleteDoc(brokerRef);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function seedDemoData() {
  const { firestore: db } = initializeFirebase();
  try {
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 10500.50,
      dailyProfit: 125.40,
      winRate: 68,
      totalTrades: 150,
      wins: 102,
      totalInvestment: 45200,
      updatedAt: serverTimestamp()
    });

    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      takeProfit: 60000,
      stopLoss: 8000,
      minBalance: 2000,
      investmentPerTrade: 4000,
      maxTradesPerDay: 20,
      maxLosses: 2,
      minRsi: 20,
      midRsi: 38,
      maxRsi: 62,
      martingale: false,
      pairs: ['EURUSD-OTC', 'GBPUSD-OTC', 'BTCUSD'],
      schedules: [{start: '07:00', end: '23:00'}],
      bot_activo: true,
      updatedAt: serverTimestamp()
    });

    const dates = Array.from({length: 15}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (15 - i));
      return d.toISOString().split('T')[0];
    });

    let currentEquity = 8500;
    for (const date of dates) {
      currentEquity += (Math.random() * 500) - 50;
      await setDoc(doc(db, 'rendimiento_diario', date.replace(/-/g, '')), {
        date,
        equity: parseFloat(currentEquity.toFixed(2))
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function clearSystemLogs() {
  return { success: true };
}
