
'use client';

import { getFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Registra una nueva operación en el historial y actualiza estadísticas.
 * Esta función es el núcleo de la ejecución automática.
 */
export async function executeTrade(userId: string, tradeData: {
  pair: string;
  direction: 'CALL' | 'PUT';
  amount: number;
}) {
  const { firestore: db } = getFirebase();
  try {
    // 1. Validar parámetros globales del bot
    const botParamsRef = doc(db, 'configuracion', 'bot_params');
    const botParamsSnap = await getDoc(botParamsRef);
    const botParams = botParamsSnap.exists() ? botParamsSnap.data() : null;

    if (botParams && !botParams.bot_activo) {
      return { success: false, error: 'Motor de IA desactivado.' };
    }

    // 2. Obtener info del bróker para saber el tipo de cuenta y validar conexión
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    if (!brokerSnap.exists() || brokerSnap.data().status !== 'connected') {
      return { success: false, error: 'Bróker no vinculado o desconectado.' };
    }
    const brokerConfig = brokerSnap.data();

    // 3. Simular resultado basado en algoritmos de probabilidad
    // La tasa de acierto se ve influenciada ligeramente por la configuración (demo/real)
    const winProbability = brokerConfig.accountType === 'demo' ? 0.70 : 0.62;
    const isWin = Math.random() < winProbability;
    const payoutRatio = 0.85; // IQ Option standard payout
    const profit = isWin ? tradeData.amount * payoutRatio : -tradeData.amount;
    const status = isWin ? 'win' : 'loss';

    // 4. Guardar el registro de la operación en el historial del usuario
    await addDoc(collection(db, 'users', userId, 'trades'), {
      ...tradeData,
      status,
      profit,
      accountType: brokerConfig.accountType,
      timestamp: new Date().toISOString()
    });

    // 5. Actualizar estadísticas globales del Dashboard
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await updateDoc(statsRef, {
      balance: increment(profit),
      dailyProfit: increment(profit),
      totalInvestment: increment(tradeData.amount),
      updatedAt: serverTimestamp()
    });

    return { success: true, status, profit, accountType: brokerConfig.accountType };
  } catch (error: any) {
    console.error('Error crítico en ejecución de trade:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza la configuración operativa del bot (Riesgo y Parámetros).
 */
export async function updateBotConfig(data: any) {
  const { firestore: db } = getFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      ...data,
      bot_activo: data.bot_activo !== undefined ? data.bot_activo : true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Fallo al actualizar núcleo del motor:', error);
    return { success: false, error: 'No se pudo sincronizar la configuración.' };
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
    console.error('Fallo en el botón de pánico:', error);
    return { success: false };
  }
}

/**
 * Gestión de Rangos y Permisos.
 */
export async function promoteToSuperAdmin(userId: string) {
  const { firestore: db } = getFirebase();
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role: 'super-admin',
      updatedAt: new Date().toISOString(),
      permissions: 'all'
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error en promoción de rango:', error);
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
    console.error('Fallo al limpiar datos de bróker:', error);
    return { success: false };
  }
}

/**
 * Inicialización de entorno para nuevos operadores.
 */
export async function seedDemoData() {
  const { firestore: db } = getFirebase();
  try {
    // 1. Estadísticas iniciales
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 10500.50,
      dailyProfit: 125.40,
      winRate: 68,
      totalInvestment: 45200,
      updatedAt: serverTimestamp()
    });

    // 2. Curva de equidad simulada
    const rendimientoRef = collection(db, 'rendimiento_diario');
    const days = 10;
    const baseValue = 9000;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      const dateStr = date.toISOString().split('T')[0];
      await addDoc(rendimientoRef, {
        date: dateStr,
        equity: baseValue + (Math.random() * 3000),
        timestamp: serverTimestamp()
      });
    }

    // 3. Parámetros por defecto
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      investmentPerTrade: 2.0,
      stopLoss: 25,
      takeProfit: 50,
      maxTradesPerDay: 15,
      martingale: true,
      pairs: ['EUR/USD', 'BTC/USD'],
      bot_activo: true,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error inicializando sistema:', error);
    return { success: false };
  }
}

export async function clearSystemLogs() {
  try {
    console.log('Solicitud de purga de logs enviada.');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
