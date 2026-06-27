'use client';

import { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, AlertTriangle, Clock, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react';

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string;
  previous: string;
  dateObj: string | null;
}

export default function CalendarPage() {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const renderImpact = (impact: string) => {
    const isHigh = impact === 'High';
    const isMed = impact === 'Medium';
    const isLow = impact === 'Low';
    
    return (
      <div className="flex gap-1">
        <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : isMed || isLow ? 'bg-orange-500' : 'bg-slate-600'}`}></div>
        <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : isMed ? 'bg-orange-500' : 'bg-slate-600'}`}></div>
        <div className={`w-2 h-2 rounded-full ${isHigh ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-600'}`}></div>
      </div>
    );
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <SidebarTrigger />
        <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendario Económico (ForexFactory)
        </h1>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-headline font-bold text-foreground">Eventos Macro-Económicos</h2>
          <p className="text-muted-foreground italic">Sincronizado en tiempo real. El bot se detendrá automáticamente en eventos "High Impact".</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary/5 border-primary/20 border-solid md:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Módulo Activo y Conectado
                  </CardTitle>
                  <CardDescription className="text-primary/70 mt-1">NeuroTrade V7 Sentinel</CardDescription>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">En Línea</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                El sistema extrae el Feed XML oficial de ForexFactory. Los eventos con calificación de alto impacto (Rojo / 3 Toros)
                activarán el protocolo de protección y pausarán las operaciones del piloto automático 15 minutos antes y después del evento.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Sincronización
                </div>
                <button onClick={fetchEvents} className="hover:text-white transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                {loading ? (
                  <>
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs text-primary uppercase tracking-widest font-bold">Actualizando...</p>
                  </>
                ) : error ? (
                  <>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <p className="text-xs text-red-500 font-bold">{error}</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-xs text-emerald-500 uppercase tracking-widest font-bold">Datos al día</p>
                    <p className="text-xs text-slate-500">Última actualización: {new Date().toLocaleTimeString()}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5 backdrop-blur-xl md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Eventos de la Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {loading && events.length === 0 ? (
                   <p className="text-sm text-slate-500 text-center py-10">Cargando eventos...</p>
                ) : events.length > 0 ? (
                  events.map((ev, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${ev.impact === 'High' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-14 h-12 rounded bg-black/40">
                          <span className="text-xs font-bold text-slate-300">{ev.time}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-white/10 font-mono text-slate-300">{ev.country}</span>
                            {ev.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">Fecha: {ev.date} | Forecast: {ev.forecast || '-'} | Prev: {ev.previous || '-'}</p>
                        </div>
                      </div>
                      <div>
                        {renderImpact(ev.impact)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-10">No hay eventos para mostrar.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
