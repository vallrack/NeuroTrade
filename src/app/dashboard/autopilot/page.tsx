'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Bot, CalendarClock, Zap, Save, Loader2, Plus, Trash2, Clock,
  CheckCircle2, Globe, ShieldCheck, Play, Pause, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, collection, query } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import {
  ALL_REGULAR_PAIRS, ALL_OTC_PAIRS, TIMEZONES,
  isForexMarketOpen, isCurrentlyInSchedule, type ScheduleSlot, type AutopilotConfig
} from '@/lib/market-schedule';

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function PairButton({ pair, selected, onToggle }: { pair: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
        selected
          ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(38,166,154,0.2)]'
          : 'bg-white/5 border-white/5 text-muted-foreground hover:border-white/20'
      }`}
    >
      {pair}
    </button>
  );
}

function SlotCard({
  slot,
  onUpdate,
  onDelete,
}: {
  slot: ScheduleSlot;
  onUpdate: (s: ScheduleSlot) => void;
  onDelete: () => void;
}) {
  const toggleDay = (day: number) => {
    const days = slot.days.includes(day)
      ? slot.days.filter(d => d !== day)
      : [...slot.days, day];
    onUpdate({ ...slot, days });
  };

  return (
    <div className={`p-4 rounded-xl border space-y-3 transition-all ${
      slot.enabled ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <Input
          value={slot.label}
          onChange={e => onUpdate({ ...slot, label: e.target.value })}
          placeholder="Nombre del horario"
          className="bg-background/50 border-white/10 h-8 text-sm flex-1"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ ...slot, enabled: !slot.enabled })}
            className={`p-1.5 rounded-lg transition-all ${slot.enabled ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-white/5'}`}
          >
            {slot.enabled ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Días */}
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map(d => (
          <button
            key={d.value}
            type="button"
            onClick={() => toggleDay(d.value)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
              slot.days.includes(d.value)
                ? 'bg-primary text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Horario */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Inicio</Label>
          <Input
            type="time"
            value={slot.from}
            onChange={e => onUpdate({ ...slot, from: e.target.value })}
            className="bg-background/50 border-white/10 h-9 text-sm font-code"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Fin</Label>
          <Input
            type="time"
            value={slot.to}
            onChange={e => onUpdate({ ...slot, to: e.target.value })}
            className="bg-background/50 border-white/10 h-9 text-sm font-code"
          />
        </div>
      </div>

      {/* Zona horaria y tipo de par */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Zona Horaria</Label>
          <select
            value={slot.timezone}
            onChange={e => onUpdate({ ...slot, timezone: e.target.value })}
            className="w-full h-9 rounded-lg bg-background/50 border border-white/10 text-sm px-3 text-foreground"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground font-bold">Tipo de Par</Label>
          <select
            value={slot.pairMode}
            onChange={e => onUpdate({ ...slot, pairMode: e.target.value as any })}
            className="w-full h-9 rounded-lg bg-background/50 border border-white/10 text-sm px-3 text-foreground"
          >
            <option value="auto">Auto (detectar)</option>
            <option value="regular">Regulares (mercado abierto)</option>
            <option value="otc">OTC (mercado cerrado)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  const botParamsDocRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'bot_params');
  }, [mounted, user, firestore]);

  const { data: botParams } = useDoc(botParamsDocRef);

  // Verificar rol del usuario (mismo patrón que app-sidebar)
  const profileDocRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [mounted, user, firestore]);
  const { data: profile } = useDoc(profileDocRef);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super-admin';

  // Obtener reportes para sugerencias de horas
  const reportsQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'reports'));
  }, [mounted, user, firestore]);
  const { data: allReports } = useCollection(reportsQuery);

  const bestHours = useMemo(() => {
    if (!allReports || allReports.length === 0) return [];
    
    const statsByHour: Record<string, { profit: number, wins: number, losses: number }> = {};
    
    allReports.forEach((r: any) => {
      if (r.hourlyStats) {
        Object.entries(r.hourlyStats).forEach(([hour, stats]: [string, any]) => {
          if (!statsByHour[hour]) statsByHour[hour] = { profit: 0, wins: 0, losses: 0 };
          statsByHour[hour].profit += stats.profit || 0;
          statsByHour[hour].wins += stats.wins || 0;
          statsByHour[hour].losses += stats.losses || 0;
        });
      }
    });

    return Object.entries(statsByHour)
      .filter(([_, stats]) => stats.profit > 0)
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 3)
      .map(([hour, stats]) => ({ hour, profit: stats.profit }));
  }, [allReports]);

  const bestPairs = useMemo(() => {
    if (!allReports || allReports.length === 0) return [];
    
    const statsByPair: Record<string, { profit: number }> = {};
    
    allReports.forEach((r: any) => {
      if (r.pairStats) {
        Object.entries(r.pairStats).forEach(([pair, stats]: [string, any]) => {
          if (!statsByPair[pair]) statsByPair[pair] = { profit: 0 };
          statsByPair[pair].profit += stats.profit || 0;
        });
      }
    });

    return Object.entries(statsByPair)
      .sort((a, b) => b[1].profit - a[1].profit) // Mayor a menor
      .slice(0, 6) // Mostrar top 6
      .map(([pair, stats]) => ({
        pair,
        profit: stats.profit,
        status: stats.profit > 0 ? 'good' : stats.profit < 0 ? 'bad' : 'neutral'
      }));
  }, [allReports]);

  // Estado local
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autoConnectBridge, setAutoConnectBridge] = useState(true);
  const [pairMode, setPairMode] = useState<'auto' | 'manual'>('auto');
  const [scheduleMode, setScheduleMode] = useState<'always' | 'auto' | 'custom'>('auto');
  const [regularPairs, setRegularPairs] = useState<string[]>(['EURUSD', 'GBPUSD', 'USDJPY']);
  const [otcPairs, setOtcPairs] = useState<string[]>(['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC']);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [now, setNow] = useState(new Date());

  // Actualizar reloj cada minuto para estado en tiempo real
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (botParams?.autopilot) {
      const ap = botParams.autopilot;
      setAutopilotEnabled(ap.enabled ?? false);
      setAutoConnectBridge(ap.autoConnectBridge ?? true);
      setPairMode(ap.pairMode ?? 'auto');
      setScheduleMode(ap.scheduleMode ?? 'auto');
      setSlots(ap.slots ?? []);
    }
    if (botParams?.regularPairs) setRegularPairs(botParams.regularPairs);
    if (botParams?.otcPairs) setOtcPairs(botParams.otcPairs);
  }, [botParams]);

  const toggleRegularPair = (pair: string) => {
    setRegularPairs(prev => prev.includes(pair) ? prev.filter(p => p !== pair) : [...prev, pair]);
  };

  const toggleOtcPair = (pair: string) => {
    setOtcPairs(prev => prev.includes(pair) ? prev.filter(p => p !== pair) : [...prev, pair]);
  };

  const addSlot = () => {
    setSlots(prev => [...prev, {
      id: generateId(),
      label: `Horario ${prev.length + 1}`,
      days: [1, 2, 3, 4, 5],
      from: '08:00',
      to: '17:00',
      timezone: 'America/Bogota',
      pairMode: 'auto',
      enabled: true,
    }]);
  };

  const updateSlot = (id: string, updated: ScheduleSlot) => {
    setSlots(prev => prev.map(s => s.id === id ? updated : s));
  };

  const deleteSlot = (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const autopilotConfig: AutopilotConfig = {
        enabled: autopilotEnabled,
        autoConnectBridge,
        pairMode,
        scheduleMode,
        slots,
      };

      if (firestore && botParamsDocRef) {
        await setDoc(botParamsDocRef, {
          regularPairs,
          otcPairs,
          autopilot: autopilotConfig,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        toast({
          title: 'AUTOPILOT CONFIGURADO',
          description: 'El piloto automático ha sido guardado exitosamente.',
        });
      }
    } catch (e: any) {
      toast({ title: 'ERROR', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Estado actual del mercado
  const forexOpen = isForexMarketOpen();
  const { active: inSchedule, slot: activeSlot } = isCurrentlyInSchedule(slots);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <SidebarTrigger />
        <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Piloto Automático
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Badge className={`gap-1.5 text-[10px] font-bold ${
            forexOpen ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${forexOpen ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
            {forexOpen ? 'FOREX ABIERTO' : 'FOREX CERRADO — OTC DISPONIBLE'}
          </Badge>
          <NotificationBell />
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6 pb-20">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-headline font-bold">Sistema AutoPilot</h2>
          <p className="text-muted-foreground text-sm">El bot opera solo, cambia de pares según el mercado y respeta tus horarios.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Panel principal ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Toggle principal */}
            <Card className="bg-card/50 border-white/5 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setAutopilotEnabled(prev => !prev)}
                  className={`w-full p-6 flex items-center justify-between transition-all ${
                    autopilotEnabled ? 'bg-primary/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                      autopilotEnabled ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/10'
                    }`}>
                      <Bot className={`h-6 w-6 ${autopilotEnabled ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-headline font-bold text-lg">
                        {autopilotEnabled ? 'AutoPilot ACTIVADO' : 'AutoPilot Desactivado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {autopilotEnabled
                          ? 'El bot controla pares, horarios y conexión automáticamente'
                          : 'Control manual — el bot usa los pares configurados en Núcleo V7'}
                      </p>
                    </div>
                  </div>
                  <div className={`h-7 w-12 rounded-full transition-all relative ${autopilotEnabled ? 'bg-primary' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${autopilotEnabled ? 'right-1' : 'left-1'}`} />
                  </div>
                </button>
              </CardContent>
            </Card>

            {autopilotEnabled && (
              <>
                {/* Modo de pares */}
                <Card className="bg-card/50 border-white/5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Selección de Pares
                    </CardTitle>
                    <CardDescription className="text-xs">Cómo elige el bot qué pares operar</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {(['auto', 'manual'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPairMode(mode)}
                          className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                            pairMode === mode
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                          }`}
                        >
                          {mode === 'auto' ? '🤖 Automático (detectar mercado)' : '🎯 Manual (pares fijos)'}
                        </button>
                      ))}
                    </div>

                    {pairMode === 'auto' && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                            Pares Regulares (mercado abierto L-V)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {ALL_REGULAR_PAIRS.map(p => (
                              <PairButton key={p} pair={p} selected={regularPairs.includes(p)} onToggle={() => toggleRegularPair(p)} />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                            Pares OTC (fin de semana / mercado cerrado)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {ALL_OTC_PAIRS.map(p => (
                              <PairButton key={p} pair={p} selected={otcPairs.includes(p)} onToggle={() => toggleOtcPair(p)} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Modo de horario */}
                <Card className="bg-card/50 border-white/5">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Horario de Operación
                    </CardTitle>
                    <CardDescription className="text-xs">Cuándo debe operar el bot</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: 'always', label: '24/7', desc: 'Siempre activo' },
                        { value: 'auto', label: 'Auto', desc: 'Sigue el mercado IQ Option' },
                        { value: 'custom', label: 'Horarios', desc: 'Mis horarios personalizados' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setScheduleMode(opt.value)}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            scheduleMode === opt.value
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                          }`}
                        >
                          <p className="text-sm font-bold">{opt.label}</p>
                          <p className="text-[9px] mt-0.5 opacity-70">{opt.desc}</p>
                        </button>
                      ))}
                    </div>

                    {scheduleMode === 'auto' && (
                      <div className="p-3 bg-white/5 rounded-xl text-xs text-muted-foreground space-y-1">
                        <p className="font-bold text-foreground">Detección Automática IQ Option:</p>
                        <p>🟢 <strong>Lunes – Viernes 00:00 – 21:00 UTC:</strong> pares regulares (EURUSD, GBPUSD...)</p>
                        <p>🟡 <strong>Viernes 21:00 – Lunes 00:00 UTC:</strong> pares OTC disponibles</p>
                      </div>
                    )}

                    {scheduleMode === 'custom' && (
                      <div className="space-y-4">
                        {/* Sugerencias Cuánticas */}
                        {(bestHours.length > 0 || bestPairs.length > 0) && (
                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                            
                            {bestHours.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                                  <Zap className="h-3 w-3" /> Horas más rentables
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {bestHours.map((bh, i) => (
                                    <Badge key={i} className="bg-primary/20 text-primary border-primary/30">
                                      {bh.hour} (+${bh.profit.toFixed(2)})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {bestPairs.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-primary/10">
                                <h4 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                                  <Globe className="h-3 w-3" /> Semáforo de Divisas
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {bestPairs.map((bp, i) => (
                                    <Badge key={i} className={`flex items-center gap-1.5 ${
                                      bp.status === 'good' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                      bp.status === 'bad' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                      'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    }`}>
                                      <div className={`h-1.5 w-1.5 rounded-full ${
                                        bp.status === 'good' ? 'bg-green-400' :
                                        bp.status === 'bad' ? 'bg-red-400' :
                                        'bg-amber-400'
                                      }`} />
                                      {bp.pair}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                        <div className="space-y-3">
                        {slots.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No hay horarios configurados. Agrega uno para comenzar.
                          </p>
                        )}
                        {slots.map(slot => (
                          <SlotCard
                            key={slot.id}
                            slot={slot}
                            onUpdate={updated => updateSlot(slot.id, updated)}
                            onDelete={() => deleteSlot(slot.id)}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addSlot}
                          className="w-full border-dashed border-white/10 bg-white/[0.02] hover:bg-primary/10 hover:border-primary/30 gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar Horario
                        </Button>
                      </div>
                    </div>
                    )}

                    {/* Auto-connect bridge */}
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="text-xs font-bold">Auto-gestionar conexión al puente</p>
                        <p className="text-[10px] text-muted-foreground">El bot activa el puente al entrar en horario</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoConnectBridge(prev => !prev)}
                        className={`h-6 w-11 rounded-full transition-all relative ${autoConnectBridge ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${autoConnectBridge ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={loading} className="gap-2 px-10 h-12 font-headline tracking-widest uppercase shadow-xl shadow-primary/20">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar AutoPilot
              </Button>
            </div>
          </div>

          {/* ─── Panel de estado en tiempo real ─── */}
          <div className="space-y-4">
            <Card className={`border ${forexOpen ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full animate-pulse ${forexOpen ? 'bg-green-400' : 'bg-amber-400'}`} />
                  Estado del Mercado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-2">
                  <p className={`text-2xl font-bold font-headline ${forexOpen ? 'text-green-400' : 'text-amber-400'}`}>
                    {forexOpen ? 'ABIERTO' : 'CERRADO'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {forexOpen ? 'Usar pares regulares' : 'Usar pares OTC'}
                  </p>
                </div>
                <div className="text-xs font-code text-muted-foreground text-center">
                  {now.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })} COL
                  {' · '}
                  {now.toUTCString().slice(17, 22)} UTC
                </div>
              </CardContent>
            </Card>

            {scheduleMode === 'custom' && slots.length > 0 && (
              <Card className={`border ${inSchedule ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/10'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Horario Activo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {inSchedule && activeSlot ? (
                    <div className="space-y-2">
                      <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        EN HORARIO
                      </Badge>
                      <p className="font-bold text-sm">{activeSlot.label}</p>
                      <p className="text-xs text-muted-foreground">{activeSlot.from} – {activeSlot.to}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        FUERA DE HORARIO
                      </Badge>
                      <p className="text-xs text-muted-foreground">Bot en espera...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-card/50 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Pares Activos Ahora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(forexOpen ? regularPairs : otcPairs).map(p => (
                    <Badge key={p} variant="outline" className="text-[9px] font-code border-primary/20 text-primary/80">
                      {p}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {forexOpen ? 'Mercado abierto' : 'Mercado cerrado — OTC'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-yellow-500" />
                  Comportamiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Pares automáticos', active: autopilotEnabled && pairMode === 'auto' },
                  { label: 'Horario automático', active: autopilotEnabled && scheduleMode !== 'custom' },
                  { label: 'Horarios personalizados', active: autopilotEnabled && scheduleMode === 'custom' },
                  { label: 'Auto-gestión puente', active: autopilotEnabled && autoConnectBridge },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-[10px]">
                    <div className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-400' : 'bg-white/20'}`} />
                    <span className={item.active ? 'text-foreground' : 'text-muted-foreground/50'}>{item.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
