
'use server';

import { db } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

export async function updateBotConfig(formData: FormData) {
  const investmentPerTrade = parseFloat(formData.get('investment') as string);
  const stopLoss = parseFloat(formData.get('stopLoss') as string);
  const martingale = formData.get('martingale') === 'on';
  const pairs = (formData.get('pairs') as string).split(',').map(s => s.trim());

  try {
    await db.collection('configuracion').doc('bot_params').set({
      investmentPerTrade,
      stopLoss,
      martingale,
      pairs,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update bot config:', error);
    return { success: false, error: 'Update failed' };
  }
}

export async function triggerKillSwitch() {
  try {
    await db.collection('configuracion').doc('bot_params').update({
      bot_activo: false,
      killedAt: new Date().toISOString(),
    });
    
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Panic button failed:', error);
    return { success: false };
  }
}

/**
 * Promueve a un usuario al rango de Super Administrador (Maestro).
 * Solo debería ser accesible por administradores existentes o en el primer setup.
 */
export async function promoteToSuperAdmin(userId: string) {
  try {
    await db.collection('users').doc(userId).set({
      role: 'super-admin',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error promoting to super admin:', error);
    return { success: false };
  }
}
