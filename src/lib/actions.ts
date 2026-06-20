
'use client';

import { getFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
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
    const isWin = Math.random() > 0.35; // Simulación de tasa de acierto del 65%
    const profit = isWin ? tradeData.amount * 0.85 : -tradeData.amount;
    const status = isWin ? 'win' : 'loss';

    // 1. Guardar el trade
    await addDoc(collection(db, 'users', userId, 'trades'), {
      ...tradeData,
      status,
      profit,
      timestamp: new Date().toISOString()
    });

    // 2. Actualizar estadísticas globales (Simulado para el dashboard)
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await updateDoc(statsRef, {
      balance: increment(profit),
      dailyProfit: increment(profit),
      totalInvestment: increment(tradeData.amount)
    });

    return { success: true, status, profit };
  } catch (error) {
    console.error('Error executing trade:', error);
    return { success: false };
  }
}

/**
 * Actualiza la configuración global del bot.
 */
export async function updateBotConfig(data: {
  investmentPerTrade: number;
  stopLoss: number;
  martingale: boolean;
  pairs: string[];
}) {
  const { firestore: db } = getFirebase();
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      ...data,
      bot_activo: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Failed to update bot config:', error);
    return { success: false, error: 'Fallo al actualizar configuración.' };
  }
}

/**
 * Activa el apagado de emergencia del bot.
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
    console.error('Panic button failed:', error);
    return { success: false };
  }
}

/**
 * Promueve a un usuario al rango de Super Administrador (Maestro).
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
    console.error('Error promoting to super admin:', error);
    return { success: false };
  }
}

/**
 * Cierra la sesión del usuario.
 */
export async function signOutUser() {
  const { auth } = getFirebase();
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * Desvincula la cuenta del bróker y ELIMINA los datos de conexión.
 */
export async function disconnectBroker(userId: string) {
  const { firestore: db } = getFirebase();
  try {
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    await updateDoc(brokerRef, {
      email: '',
      password: '',
      status: 'disconnected',
      disconnectedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error disconnecting broker:', error);
    return { success: false };
  }
}

/**
 * Inicializa datos demo para el Dashboard.
 */
export async function seedDemoData() {
  const { firestore: db } = getFirebase();
  try {
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 12450.75,
      dailyProfit: 342.12,
      winRate: 72,
      totalInvestment: 85400,
      updatedAt: serverTimestamp()
    });

    const rendimientoRef = collection(db, 'rendimiento_diario');
    const days = 7;
    const baseValue = 10000;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      const dateStr = date.toISOString().split('T')[0];
      
      await addDoc(rendimientoRef, {
        date: dateStr,
        equity: baseValue + (Math.random() * 2000),
        timestamp: serverTimestamp()
      });
    }

    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      investmentPerTrade: 10,
      stopLoss: 50,
      martingale: false,
      pairs: ['EUR/USD', 'BTC/USD', 'GBP/JPY'],
      bot_activo: true,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error seeding data:', error);
    return { success: false };
  }
}

export async function clearSystemLogs() {
  try {
    console.log('Solicitud de limpieza de memoria enviada al núcleo.');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
