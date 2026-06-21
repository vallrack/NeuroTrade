
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * 🛰️ NEUROTRADE V7 - MÓDULO DE COMUNICACIÓN REMOTA
 * Direcciona las órdenes al puente (Local o Servidor Pro)
 */

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "http://127.0.0.1:8888";
const BRIDGE_TOKEN = process.env.BRIDGE_SECRET_KEY || "quantum_v7_secure_key_123";

async function callBridge(endpoint: string, payload: any) {
  try {
    const response = await fetch(`${BRIDGE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Bridge-Token': BRIDGE_TOKEN
      },
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
       const errData = await response.json().catch(() => ({}));
       throw new Error(errData.error || `HTTP_Error_${response.status}`);
    }
    
    return await response.json();
  } catch (e: any) {
    console.error(`Bridge Call Error [${endpoint}]:`, e.message);
    throw e;
  }
}

export async function updateBrokerConfig(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  try {
    const configRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    // Al actualizar config, intentamos un handshake con el puente de una vez
    try {
      await callBridge('/connect', {
        email: data.email,
        password: data.password,
        accountType: data.accountType,
        uid: userId
      });
    } catch (e) {
      console.warn("Handshake inicial fallido, pero configuración guardada.");
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'FALLO AL GUARDAR CONFIGURACIÓN' };
  }
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
    const accountType = brokerSnap.exists() ? (brokerSnap.data().accountType || 'demo') : 'demo';

    // LLAMADA AL PUENTE PRO (Remoto o Local)
    const result = await callBridge('/trade', {
      uid: userId,
      pair: tradeData.pair,
      direction: tradeData.direction,
      amount: tradeData.amount
    });
    
    if (!result.success) return { success: false, error: result.error };
    
    const timestamp = new Date().toISOString();
    const statsRef = doc(db, 'users', userId, 'trading_stats', accountType);

    await addDoc(collection(db, 'users', userId, 'trades'), {
      ...tradeData,
      status: result.status,
      profit: result.profit,
      timestamp,
      accountType
    });

    await updateDoc(statsRef, {
      balance: increment(result.profit),
      dailyProfit: increment(result.profit),
      tradesCount: increment(1)
    });

    return { success: true, status: result.status, profit: result.profit };
  } catch (e: any) {
    return { success: false, error: 'Sin respuesta del puente de datos.' };
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

export async function disconnectBroker(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await deleteDoc(doc(db, 'users', userId, 'config', 'broker'));
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
