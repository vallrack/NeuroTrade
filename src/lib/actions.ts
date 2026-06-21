
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc, increment, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

/**
 * PROTOCOLO MAESTRO V7 - COMUNICACIÓN UNILATERAL CON BROKER
 */

export async function updateBrokerConfig(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  try {
    const configRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(configRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating broker config:', error);
    return { success: false, error: 'FALLO AL GUARDAR CONFIGURACIÓN' };
  }
}

export async function syncBrokerProfile(userId: string, brokerData: any) {
  const { firestore: db } = initializeFirebase();
  try {
    // LLAMADA AL PUENTE LOCAL (PYTHON)
    try {
      const bridgeResponse = await fetch('http://127.0.0.1:8888/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          email: brokerData.email,
          password: brokerData.password,
          accountType: brokerData.accountType,
          uid: userId
        })
      });
      
      const result = await bridgeResponse.json();
      
      if (!bridgeResponse.ok || !result.success) {
        return { success: false, error: result.error || 'Credenciales inválidas o bloqueadas.' };
      }
      
      const accountType = brokerData.accountType;
      const statsRef = doc(db, 'users', userId, 'trading_stats', accountType);
      
      await setDoc(statsRef, {
        balance: result.balance,
        status: 'ACTIVE_BRIDGE',
        lastSync: new Date().toISOString(),
        version: 'V7-REAL'
      }, { merge: true });

      return { success: true, balance: result.balance };
      
    } catch (e: any) {
      return { success: false, error: 'El puente local no respondió.' };
    }
  } catch (error: any) {
    return { success: false, error: 'ERROR CRÍTICO DE SINCRONIZACIÓN' };
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
    const brokerConfig = brokerSnap.exists() ? brokerSnap.data() : { accountType: 'demo' };
    const accountType = brokerConfig.accountType || 'demo';

    // LLAMADA AL PUENTE DE PYTHON
    try {
      const tradeResponse = await fetch('http://127.0.0.1:8888/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          uid: userId,
          pair: tradeData.pair,
          direction: tradeData.direction,
          amount: tradeData.amount
        })
      });
      
      const result = await tradeResponse.json();
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
      return { success: false, error: 'Sin conexión con el puente local.' };
    }
  } catch (error: any) {
    return { success: false, error: 'ERROR EN EL PROCESO DE TRADING' };
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

export async function disconnectBroker(userId: string) {
  const { firestore: db } = initializeFirebase();
  try {
    await deleteDoc(doc(db, 'users', userId, 'config', 'broker'));
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
