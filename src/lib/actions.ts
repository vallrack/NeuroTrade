
'use server';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, collection, addDoc, getDoc, increment, deleteDoc } from 'firebase/firestore';

// Inyectamos la config directamente para evitar importar 'use client'
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function getServerDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

/**
 * 🛰️ NEUROTRADE V7 - SERVER ACTIONS
 */

export async function updateBrokerConfig(userId: string, data: any) {
  try {
    const db = getServerDb();
    if (!userId) throw new Error("UID_REQUIRED");

    // 1. Persistencia local en Firestore
    const configRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    // 2. Sincronización de estadísticas (Mock de éxito)
    const statsRef = doc(db, 'users', userId, 'trading_stats', data.accountType);
    await setDoc(statsRef, {
      balance: 10000.00,
      status: 'connected',
      currentAccountId: data.email,
      lastSync: new Date().toISOString()
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error("Action Error:", error.message);
    return { success: false, error: error.message };
  }
}

export async function executeTrade(userId: string, tradeData: any) {
  try {
    const db = getServerDb();
    const timestamp = new Date().toISOString();
    await addDoc(collection(db, 'users', userId, 'trades'), {
      ...tradeData,
      status: 'win',
      profit: 8.7,
      timestamp,
      accountType: 'demo'
    });
    return { success: true, status: 'win', profit: 8.7 };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateBotConfig(data: any) {
  try {
    const db = getServerDb();
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
  try {
    const db = getServerDb();
    const configRef = doc(db, 'configuracion', 'bot_params');
    await updateDoc(configRef, { bot_activo: false });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function disconnectBroker(userId: string) {
  try {
    const db = getServerDb();
    await deleteDoc(doc(db, 'users', userId, 'config', 'broker'));
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
