'use server';

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getServerDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

function getServerBridgeUrl(clientBridgeUrl?: string): string {
  const url =
    clientBridgeUrl ||
    process.env.BRIDGE_URL ||
    process.env.NEXT_PUBLIC_BRIDGE_URL ||
    'https://eurotrade-bridge.onrender.com';
  return url.replace(/\/$/, '');
}

function getServerBridgeToken(): string {
  return (
    process.env.BRIDGE_TOKEN ||
    process.env.NEXT_PUBLIC_BRIDGE_TOKEN ||
    'neurotrade-secret-2024'
  );
}

export async function updateBrokerConfig(userId: string, data: Record<string, unknown>) {
  try {
    const db = getServerDb();
    if (!userId) throw new Error('UID_REQUIRED');

    const configRef = doc(db, 'users', userId, 'config', 'broker');
    await setDoc(
      configRef,
      { ...data, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    const accountType = (data.accountType as string) || 'demo';
    let balance = 0;

    if (data.email && data.password) {
      try {
        const res = await fetch(`${getServerBridgeUrl()}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': getServerBridgeToken(),
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            accountType,
          }),
        });
        const json = await res.json();
        if (json.success) balance = json.balance;
      } catch {
        /* bridge offline — se guarda config igual */
      }
    }

    const statsRef = doc(db, 'users', userId, 'trading_stats', accountType);
    await setDoc(
      statsRef,
      {
        balance,
        status: 'connected',
        currentAccountId: data.email,
        lastSync: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true, balance };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Action Error:', message);
    return { success: false, error: message };
  }
}

export async function executeTrade(
  userId: string,
  tradeData: {
    pair: string;
    direction: 'CALL' | 'PUT';
    amount: number;
    accountType?: string;
    bridgeUrl?: string;
  }
) {
  try {
    const db = getServerDb();
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    const broker = brokerSnap.data();

    if (!broker?.email || !broker?.password) {
      return { success: false, error: 'Bróker no configurado. Vaya a Broker Link.' };
    }

    const accountType = tradeData.accountType || broker.accountType || 'demo';
    const bridgeUrl = getServerBridgeUrl(tradeData.bridgeUrl);

    const res = await fetch(`${bridgeUrl}/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': getServerBridgeToken(),
      },
      body: JSON.stringify({
        email: broker.email,
        password: broker.password,
        pair: tradeData.pair,
        direction: tradeData.direction,
        amount: tradeData.amount,
        accountType,
      }),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      return { success: false, error: result.error || 'Error al ejecutar en el puente' };
    }

    const timestamp = new Date().toISOString();
    const isWin = result.status === 'win';

    await addDoc(collection(db, 'users', userId, 'trades'), {
      pair: tradeData.pair,
      direction: tradeData.direction,
      amount: tradeData.amount,
      status: result.status,
      profit: result.profit,
      orderId: result.orderId,
      timestamp,
      accountType,
      broker: 'IQ Option',
    });

    const statsRef = doc(db, 'users', userId, 'trading_stats', accountType);
    const statsSnap = await getDoc(statsRef);
    const prev = statsSnap.data() || {};

    await setDoc(
      statsRef,
      {
        balance: result.balance ?? prev.balance,
        tradesCount: (prev.tradesCount || 0) + 1,
        winsCount: (prev.winsCount || 0) + (isWin ? 1 : 0),
        dailyProfit: (prev.dailyProfit || 0) + (result.profit || 0),
        lastSync: timestamp,
        status: 'connected',
      },
      { merge: true }
    );

    return {
      success: true,
      status: result.status,
      profit: result.profit,
      balance: result.balance,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, error: message };
  }
}

export async function updateBotConfig(data: Record<string, unknown>) {
  try {
    const db = getServerDb();
    const configRef = doc(db, 'configuracion', 'bot_params');
    await setDoc(
      configRef,
      { ...data, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function triggerKillSwitch() {
  try {
    const db = getServerDb();
    const configRef = doc(db, 'configuracion', 'bot_params');
    await updateDoc(configRef, { bot_activo: false });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function disconnectBroker(userId: string) {
  try {
    const db = getServerDb();
    const brokerRef = doc(db, 'users', userId, 'config', 'broker');
    const brokerSnap = await getDoc(brokerRef);
    const broker = brokerSnap.data();

    if (broker?.email) {
      try {
        await fetch(`${getServerBridgeUrl()}/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Token': getServerBridgeToken(),
          },
          body: JSON.stringify({
            email: broker.email,
            accountType: broker.accountType || 'demo',
          }),
        });
      } catch {
        /* ignorar si el puente no responde */
      }
    }

    await deleteDoc(brokerRef);
    return { success: true };
  } catch {
    return { success: false };
  }
}
