'use client';

import { useState, useMemo, useEffect } from 'react';
import { Bell, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const LS_LAST_SEEN = 'nt_notif_last_seen';

function getLastSeen(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return localStorage.getItem(LS_LAST_SEEN) || new Date(0).toISOString();
}

function markAsSeen() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => { setMounted(true); }, []);

  const tradesQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'trades'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
  }, [mounted, user, firestore]);

  const { data: trades } = useCollection(tradesQuery);

  // Calcular cuántas operaciones son "nuevas" (después del último vistazo)
  const lastSeen = mounted ? getLastSeen() : new Date(0).toISOString();
  const unseenCount = trades?.filter((t: any) => t.timestamp > lastSeen).length ?? 0;

  const handleOpen = () => {
    setOpen(prev => {
      if (!prev) markAsSeen(); // marcar al abrir
      return !prev;
    });
  };

  const handleClose = () => setOpen(false);

  // Totales del día
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades?.filter((t: any) => t.timestamp?.startsWith(today)) ?? [];
  const todayProfit = todayTrades.reduce((acc: number, t: any) => acc + (t.profit ?? 0), 0);
  const todayWins = todayTrades.filter((t: any) => t.status === 'win').length;
  const todayLosses = todayTrades.filter((t: any) => t.status === 'loss').length;

  if (!mounted) return null;

  return (
    <div className="relative">
      {/* Botón campana */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={handleOpen}
        id="notification-bell-btn"
      >
        <Bell className="h-4 w-4" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </Button>

      {/* Panel desplegable */}
      {open && (
        <>
          {/* Overlay para cerrar al hacer clic fuera */}
          <div className="fixed inset-0 z-40" onClick={handleClose} />

          <div className="absolute right-0 top-10 w-80 z-50 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold font-headline">Notificaciones</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Resumen del día */}
            {todayTrades.length > 0 && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-2">Resumen de Hoy</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className={cn('text-sm font-bold font-headline', todayProfit >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {todayProfit >= 0 ? '+' : ''}${todayProfit.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">PnL</p>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-sm font-bold font-headline text-green-400">{todayWins}</p>
                    <p className="text-[9px] text-muted-foreground">Ganadas</p>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-sm font-bold font-headline text-red-400">{todayLosses}</p>
                    <p className="text-[9px] text-muted-foreground">Perdidas</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de operaciones */}
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {!trades || trades.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sin operaciones recientes</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {trades.map((t: any) => {
                    const isWin = t.status === 'win';
                    const isLoss = t.status === 'loss';
                    const isTie = t.status === 'tie';
                    const isNew = t.timestamp > lastSeen;

                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5',
                          isNew && 'bg-primary/5'
                        )}
                      >
                        {/* Icono resultado */}
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                          isWin ? 'bg-green-500/15 text-green-400' :
                          isLoss ? 'bg-red-500/15 text-red-400' :
                          'bg-white/10 text-muted-foreground'
                        )}>
                          {isWin ? <TrendingUp className="h-4 w-4" /> :
                           isLoss ? <TrendingDown className="h-4 w-4" /> :
                           <Minus className="h-4 w-4" />}
                        </div>

                        {/* Info operación */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-white">{t.pair || '—'}</p>
                            <Badge className={cn(
                              'text-[8px] px-1 py-0 h-4',
                              t.direction === 'CALL' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                            )}>
                              {t.direction || '—'}
                            </Badge>
                            {isNew && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            ${t.amount} · {t.timestamp ? new Date(t.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>

                        {/* Profit */}
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-sm font-bold font-headline',
                            isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-muted-foreground'
                          )}>
                            {t.profit != null ? (t.profit >= 0 ? '+' : '') + '$' + Number(t.profit).toFixed(2) : '—'}
                          </p>
                          <p className="text-[9px] uppercase text-muted-foreground">
                            {t.status || '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
