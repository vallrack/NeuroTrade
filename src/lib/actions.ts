
'use client';

import { getFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * Actualiza la configuración global del bot.
 */
export async function updateBotConfig(data: {
  investmentPerTrade: number;
  stopLoss: number;
  martingale: boolean;
  pairs: string[];
}) {
  const { db } = getFirebase();
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
  const { db } = getFirebase();
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
  const { db } = getFirebase();
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
 * Inicializa datos demo para el Dashboard.
 */
export async function seedDemoData() {
  const { db } = getFirebase();
  try {
    // 1. Estadísticas actuales
    const statsRef = doc(db, 'dashboard', 'current_stats');
    await setDoc(statsRef, {
      balance: 12450.75,
      dailyProfit: 342.12,
      winRate: 72,
      totalInvestment: 85400,
      updatedAt: serverTimestamp()
    });

    // 2. Datos de gráfico (Rendimiento diario)
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

    // 3. Parámetros del bot
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

/**
 * Limpia los logs históricos de la base de datos (Simulado).
 */
export async function clearSystemLogs() {
  try {
    console.log('Solicitud de limpieza de memoria enviada al núcleo.');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
