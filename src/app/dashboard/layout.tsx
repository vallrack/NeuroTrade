'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import { doc } from 'firebase/firestore';

import { BotEngineProvider } from '@/components/dashboard/bot-engine-provider';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const profileDocRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [mounted, user, firestore]);

  const { data: profile, loading: profileLoading } = useDoc(profileDocRef);

  // ─── Lógica de suscripción ───────────────────────────────────────────────────
  const isSuperAdmin = profile?.role === 'super-admin';
  const subscriptionEnd: string | null = profile?.subscriptionEnd ?? null;
  const isLifetime = profile?.subscriptionPlan === 'lifetime';

  const isExpired = !isSuperAdmin && !isLifetime && subscriptionEnd
    ? new Date(subscriptionEnd) < new Date()
    : false;

  const daysUntilExpiry = subscriptionEnd && !isLifetime && !isSuperAdmin
    ? Math.ceil((new Date(subscriptionEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 5;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Redirigir si la suscripción expiró
  useEffect(() => {
    if (mounted && !loading && !profileLoading && isExpired) {
      router.push('/dashboard/expired');
    }
  }, [mounted, loading, profileLoading, isExpired, router]);

  if (loading || (mounted && user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  if (isExpired) return null; // useEffect redirigirá

  return (
    <BotEngineProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-background flex flex-col min-h-screen overflow-hidden">
          {/* Banner de caducidad próxima */}
          {showExpiryWarning && (
            <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-amber-400 text-xs font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                ⚠️ Tu suscripción{' '}
                {daysUntilExpiry === 0
                  ? 'vence HOY'
                  : `vence en ${daysUntilExpiry} día${daysUntilExpiry === 1 ? '' : 's'}`}
                {' '}— Contacta al administrador para renovar.
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400/70">
                <Clock className="h-3 w-3" />
                {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString('es-CO') : ''}
              </span>
            </div>
          )}
          {children}
        </SidebarInset>
      </SidebarProvider>
    </BotEngineProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
