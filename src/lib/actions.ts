
'use client';

import { db } from '@/firebase/client';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Actualiza la configuración global del bot usando el SDK de Cliente.
 */
export async function updateBotConfig(data: {
  investmentPerTrade: number;
  stopLoss: number;
  martingale: boolean;
  pairs: string[];
}) {
  try {
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(configRef, {
      ...data,
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
