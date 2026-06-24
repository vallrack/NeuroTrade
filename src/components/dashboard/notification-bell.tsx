'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { cn } from '@/lib/utils';

const LS_LAST_SEEN_COUNT = 'nt_notif_last_count';

function getLastSeenCount(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LS_LAST_SEEN_COUNT) || '0');
}

function saveSeenCount(n: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_LAST_SEEN_COUNT, String(n));
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const prevTopTradeId = useRef<string | null>(null);

  const { recentTrades, liveWins, liveLosses, liveProfit } = useBotEngine();

  useEffect(() => { setMounted(true); }, []);

  // Detectar nuevas operaciones para el badge y la animación de la campana
  useEffect(() => {
    if (!mounted || recentTrades.length === 0) return;
    
    const topTradeId = recentTrades[0].id;

    if (prevTopTradeId.current !== null && topTradeId !== prevTopTradeId.current) {
      // Llegó un nuevo trade
      if (!open) {
        setUnseenCount(prev => prev + 1);
        // Agitar la campana
        setAnimating(true);
        setTimeout(() => setAnimating(false), 600);
      }
    }
    prevTopTradeId.current = topTradeId;
  }, [recentTrades, mounted, open]);

  const handleOpen = () => {
    setOpen(prev => {
      if (!prev) {
        // Al abrir → limpiar badge
        setUnseenCount(0);
      }
      return !prev;
    });
  };

  const handleClose = () => setOpen(false);

  // Totales de sesión (vienen directamente del motor en tiempo real)
  const totalTrades = liveWins + liveLosses;

  if (!mounted) return null;

  return (
    <div className="relative">
      {/* Botón campana */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 relative transition-transform',
          animating && 'animate-[wiggle_0.5s_ease-in-out]'
        )}
        onClick={handleOpen}
        id="notification-bell-btn"
      >
        <Bell className={cn('h-4 w-4 transition-colors', unseenCount > 0 && 'text-primary')} />
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
                <span className="text-sm font-bold font-headline">Operaciones del Bot</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Resumen de sesión en tiempo real */}
            {totalTrades > 0 && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-2">Sesión Actual</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className={cn('text-sm font-bold font-headline', liveProfit >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {liveProfit >= 0 ? '+' : ''}${liveProfit.toFixed(2)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">PnL</p>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-sm font-bold font-headline text-green-400">{liveWins}</p>
                    <p className="text-[9px] text-muted-foreground">Ganadas</p>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded-lg">
                    <p className="text-sm font-bold font-headline text-red-400">{liveLosses}</p>
                    <p className="text-[9px] text-muted-foreground">Perdidas</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de operaciones recientes */}
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {recentTrades.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sin operaciones en esta sesión</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Las operaciones aparecerán aquí cuando el bot opere</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentTrades.map((t: any) => {
                    const isWin = t.status === 'win';
                    const isLoss = t.status === 'loss';

                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
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

      <style jsx>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-15deg); }
          40% { transform: rotate(15deg); }
          60% { transform: rotate(-10deg); }
          80% { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
}
