
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, getDoc, increment, deleteDoc } from 'firebase/firestore';

/**
 * 🛰️ NEUROTRADE V7 - MÓDULO DE COMUNICACIÓN REMOTA
 */

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "https://dprogramadores.com.co/nt-bridge";
const BRIDGE_TOKEN = process.env.BRIDGE_SECRET_KEY || "quantum_v7_secure_key_123";

async function callBridge(endpoint: string, payload: any) {
  try {
    console.log(`📡 Llamando al puente: ${BRIDGE_URL}${endpoint}`);
    
    // Verificamos que la URL sea válida
    const targetUrl = `${BRIDGE_URL}${endpoint}`.replace(/([^:]\/)\/+/g, "$1"); // Evitar dobles slashes //
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Bridge-Token': BRIDGE_TOKEN
      },
      cache: 'no-store',
      // Importante para entornos servidor a servidor
      next: { revalidate: 0 } 
    });
    
    if (!response.ok) {
       const text = await response.text();
       console.error(`❌ Error respuesta Bridge [${response.status}]:`, text);
       throw new Error(`BRIDGE_HTTP_${response.status}`);
    }
    
    return await response.json();
  } catch (e: any) {
    console.error(`🚨 Fallo Crítico de conexión al Bridge [${endpoint}]:`, e.message);
    throw new Error(`BRIDGE_CONNECTION_FAILED: ${e.message}`);
  }
}

export async function updateBrokerConfig(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  try {
    // 1. Persistencia local en Firestore
    const configRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    // 2. Intento de Handshake con el servidor remoto
    try {
      const result = await callBridge('/connect', {
        email: data.email,
        password: data.password,
        accountType: data.accountType,
        uid: userId
      });
      
      if (result.success && result.balance) {
        const statsRef = doc(db, 'users', userId, 'trading_stats', data.accountType);
        await setDoc(statsRef, {
          balance: result.balance,
          status: 'connected',
          lastSync: new Date().toISOString()
        }, { merge: true });
      }
    } catch (e: any) {
      console.warn("Handshake fallido, se reintentará en el monitor:", e.message);
      // No lanzamos error para que la config se guarde aunque el bridge esté temporalmente offline
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error en updateBrokerConfig action:", error);
    return { success: false, error: error.message };
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
    return { success: false, error: e.message };
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
