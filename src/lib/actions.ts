
'use client';

import { getFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Capa de Abstracción de Bróker (Bridge).
 * Maneja la lógica de ejecución dependiendo del proveedor seleccionado.
 */
async function processBrokerTrade(broker: string, credentials: any, tradeData: any) {
  // Simulación de los protocolos técnicos descritos:
  // IQ Option: HTTP Login -> SSID -> WebSocket buyV3
  // Alpaca: REST Create Order
  // Binance: CCXT createOrder
  
  console.log(`[Bridge V7] Iniciando ejecución en ${broker}...`);
  
  // Simulación de latencia de red WSS
  await new Promise(resolve => setTimeout(resolve, 300));

  const isWin = Math.random() > 0.32; // ~68% Win Rate V7
  const payoutRatio = broker === 'IQ Option' ? 0.85 : 0.95; 
  const profit = isWin ? tradeData.amount * payoutRatio : -tradeData.amount;
  const status = isWin ? 'win' : 'loss';

  return { success: true, status, profit };
}

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

    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    if (!brokerSnap.exists() || brokerSnap.data().status !== 'connected') {
      return { success: false, error: 'Bróker no vinculado.' };
    }
    
    const brokerConfig = brokerSnap.data();

    // Procesar a través del Bridge V7
    const execution = await processBrokerTrade(brokerConfig.provider, brokerConfig, tradeData);

    if (execution.success) {
      // Guardar trade en Firestore
      addDoc(collection(db, 'users', userId, 'trades'), {
        ...tradeData,
        status: execution.status,
        profit: execution.profit,
        accountType: brokerConfig.accountType,
        broker: brokerConfig.provider,
        timestamp: new Date().toISOString()
      });

      // Actualizar estadísticas globales
      const statsRef = doc(db, 'dashboard', 'current_stats');
      updateDoc(statsRef, {
        balance: increment(execution.profit),
        dailyProfit: increment(execution.profit),
        totalInvestment: increment(tradeData.amount),
        updatedAt: serverTimestamp()
      });

      return { ...execution, accountType: brokerConfig.accountType };
    }

    return { success: false, error: 'Fallo en la ejecución del Bridge.' };
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
 * Seed inicial con los VALORES MAESTROS EXACTOS de la imagen V7.
 */
export async function seedDemoData() {
  const { firestore: db } = getFirebase();
  try {
    // Estadísticas iniciales del Dashboard
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 10500.50,
      dailyProfit: 125.40,
      winRate: 68,
      totalInvestment: 45200,
      updatedAt: serverTimestamp()
    });

    // Parámetros Maestros V7
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

    // Rendimiento diario
    const dates = [
      '2024-05-15', '2024-05-16', '2024-05-17', '2024-05-18', '2024-05-19', 
      '2024-05-20', '2024-05-21', '2024-05-22', '2024-05-23', '2024-05-24'
    ];
    let currentEquity = 8000;
    
    for (const date of dates) {
      currentEquity += (Math.random() * 800) - 200;
      const recordId = date.replace(/-/g, '');
      await setDoc(doc(db, 'rendimiento_diario', recordId), {
        date,
        equity: currentEquity
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Fallo al inyectar datos V7:", error);
    return { success: false };
  }
}

export async function clearSystemLogs() {
  return { success: true };
}
