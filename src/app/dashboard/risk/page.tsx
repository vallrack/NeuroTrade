'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  Loader2,
  Target,
  Save,
  Lock,
  Plus,
  X,
  Globe,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Todos los pares disponibles en IQ Option
const ALL_IQ_PAIRS = [
  // OTC (disponibles 24/7)
  'EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC', 'AUDUSD-OTC', 'USDCAD-OTC',
  'USDCHF-OTC', 'EURGBP-OTC', 'EURJPY-OTC', 'GBPJPY-OTC', 'AUDCAD-OTC',
  'NZDUSD-OTC', 'EURCAD-OTC', 'EURCHF-OTC', 'AUDCHF-OTC', 'CADCHF-OTC',
  'AUDNZD-OTC', 'GBPCAD-OTC', 'NZDCAD-OTC', 'CHFJPY-OTC', 'GBPCHF-OTC',
  'EURAUD-OTC', 'GBPAUD-OTC', 'EURCAD-OTC', 'NZDCHF-OTC', 'SGDJPY-OTC',
  // Forex real (solo en horario de mercado)
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY', 'NZDUSD',
];

export default function RiskPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [pairSearch, setPairSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    investmentPerTrade: 500,
    stopLoss: 8000,
    takeProfit: 10000,
    maxDailyTrades: 20,
    martingaleMultiplier: 2.1,
    min_confidence_score: 85,
  });
  const [activePairs, setActivePairs] = useState<string[]>(['EURUSD-OTC', 'GBPUSD-OTC']);

  useEffect(() => { setMounted(true); }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);

  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  useEffect(() => {
    if (botParams) {
      setFormData({
        investmentPerTrade: botParams.investmentPerTrade || 500,
        stopLoss: botParams.stopLoss || 8000,
        takeProfit: botParams.takeProfit || 10000,
        maxDailyTrades: botParams.maxDailyTrades || 20,
        martingaleMultiplier: botParams.martingaleMultiplier || 2.1,
        min_confidence_score: botParams.min_confidence_score || 85,
      });
      if (botParams.pairs && Array.isArray(botParams.pairs)) {
        setActivePairs(botParams.pairs);
      }
    }
  }, [botParams]);

  const handleSave = async () => {
    if (!firestore || !botParamsRef) return;
    setSaving(true);
    try {
      await setDoc(botParamsRef, {
        ...formData,
        pairs: activePairs,
        lastUpdated: new Date(),
        updatedBy: user?.email,
      }, { merge: true });
      toast({ title: 'PROTOCOLOS ACTUALIZADOS', description: 'Parámetros de riesgo y pares sincronizados correctamente.' });
      window.dispatchEvent(new CustomEvent('nt_force_sync', { detail: { ...formData, pairs: activePairs } }));
    } catch (e: any) {
      toast({ title: 'ERROR DE PERSISTENCIA', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
  };

  // ── Pares ────────────────────────────────────────────────────────
  const addPair = (pair: string) => {
    const normalized = pair.trim().toUpperCase();
    if (!normalized) return;
    if (!activePairs.includes(normalized)) {
      setActivePairs(prev => [...prev, normalized]);
    }
    setPairSearch('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const removePair = (pair: string) => {
    if (activePairs.length <= 1) {
      toast({ title: 'Mínimo 1 par requerido', variant: 'destructive' });
      return;
    }
    setActivePairs(prev => prev.filter(p => p !== pair));
  };

  const query = pairSearch.toLowerCase();
  const filteredPairs = ALL_IQ_PAIRS.filter(
    p => !activePairs.includes(p) && p.toLowerCase().includes(query)
  );
  const filteredOTC  = filteredPairs.filter(p =>  p.includes('-OTC'));
  const filteredReal = filteredPairs.filter(p => !p.includes('-OTC'));

  // Par personalizado que no existe en la lista
  const typedIsCustom =
    pairSearch.trim().length >= 3 &&
    !ALL_IQ_PAIRS.some(p => p.toLowerCase() === pairSearch.trim().toLowerCase()) &&
    !activePairs.includes(pairSearch.trim().toUpperCase());

  if (!mounted) return null;

  return (
    <>
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6 border-b border-white/5 sticky top-0 bg-background/95 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="hidden sm:block mr-2 h-4" />
          <h1 className="font-headline text-lg font-bold tracking-tight text-white truncate">Seguridad Cuántica</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-3xl font-black font-headline tracking-tighter text-white">Gestión de Riesgo V7</h2>
          <p className="text-muted-foreground text-sm font-medium italic">Configure los muros de contención algorítmica.</p>
        </div>

        {/* ── Parámetros de Riesgo ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Monto por operación */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-primary/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Apalancamiento V7</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Monto por Operación</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                  <Input
                    type="number"
                    value={formData.investmentPerTrade}
                    onChange={e => handleInputChange('investmentPerTrade', e.target.value)}
                    className="bg-white/5 border-white/10 pl-8 h-12 font-mono text-lg font-bold text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">Inversión calculada por cada ciclo de la IA.</p>
            </CardContent>
          </Card>

          {/* Stop Loss */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-destructive/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-destructive/10 rounded-lg w-fit mb-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Firewall de Pérdidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Stop Loss Diario (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                  <Input
                    type="number"
                    value={formData.stopLoss}
                    onChange={e => handleInputChange('stopLoss', e.target.value)}
                    className="bg-white/5 border-white/10 pl-8 h-12 font-mono text-lg font-bold text-destructive"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">El bot hibernará automáticamente al alcanzar esta pérdida.</p>
            </CardContent>
          </Card>

          {/* Precisión IA */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-blue-400/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-blue-400/10 rounded-lg w-fit mb-2">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Filtro de IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Precisión Mínima (%)</Label>
                <div className="relative">
                  <Input
                    type="number" min="50" max="100"
                    value={formData.min_confidence_score}
                    onChange={e => handleInputChange('min_confidence_score', e.target.value)}
                    className="bg-white/5 border-white/10 h-12 font-mono text-lg font-bold text-blue-400 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">%</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">Umbral mínimo para permitir una entrada al mercado.</p>
            </CardContent>
          </Card>

          {/* Martingala */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-purple-400/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-purple-400/10 rounded-lg w-fit mb-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Multiplicador Martingala</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Factor (ej. 2.1)</Label>
                <div className="relative">
                  <Input
                    type="number" step="0.1" min="1" max="3"
                    value={formData.martingaleMultiplier}
                    onChange={e => handleInputChange('martingaleMultiplier', e.target.value)}
                    className="bg-white/5 border-white/10 h-12 font-mono text-lg font-bold text-purple-400 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">x</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">Si pierdes, multiplicará tu siguiente inversión por este factor.</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Gestión de Pares ─────────────────────────────────────── */}
        <Card className="bg-black/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="pb-4">
            {/* Título */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Globe className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Pares de Divisas Activos</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">El bot rotará entre estos pares en cada ciclo de análisis.</p>
              </div>
            </div>

            {/* Buscador + entrada manual */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
              <Input
                ref={searchInputRef}
                value={pairSearch}
                onChange={e => setPairSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredPairs.length === 1) addPair(filteredPairs[0]);
                    else if (typedIsCustom) addPair(pairSearch.trim());
                  }
                  if (e.key === 'Escape') setPairSearch('');
                }}
                placeholder="Buscar o escribir par (ej: GBPJPY-OTC)…"
                className="pl-9 pr-24 bg-white/5 border-white/10 h-11 font-mono text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:ring-emerald-500/20"
              />
              {pairSearch.trim().length >= 3 && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (filteredPairs.length === 1) addPair(filteredPairs[0]);
                    else addPair(pairSearch.trim());
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar
                </Button>
              )}
            </div>

            {/* Lista filtrada — solo cuando hay texto */}
            {pairSearch.trim().length > 0 && (
              <div className="mt-2 bg-slate-900/90 border border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                {/* Sin resultados */}
                {filteredOTC.length === 0 && filteredReal.length === 0 && !typedIsCustom && (
                  <div className="px-4 py-3 text-[11px] text-slate-500 italic">
                    Sin coincidencias en IQ Option.
                    {pairSearch.trim().length >= 3 && (
                      <> Presiona{' '}
                        <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">Enter</kbd>{' '}
                        para agregar <strong className="text-slate-300">{pairSearch.trim().toUpperCase()}</strong> como par personalizado.
                      </>
                    )}
                  </div>
                )}

                {/* Opción: par personalizado */}
                {typedIsCustom && (
                  <button
                    onClick={() => addPair(pairSearch.trim())}
                    className="w-full text-left px-4 py-2.5 text-[11px] font-mono text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/15 flex items-center gap-2 border-b border-white/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    Agregar par personalizado:{' '}
                    <span className="font-bold">{pairSearch.trim().toUpperCase()}</span>
                  </button>
                )}

                {/* OTC */}
                {filteredOTC.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[9px] text-slate-600 uppercase tracking-widest font-bold bg-white/5 border-b border-white/5">
                      OTC — Disponibles 24/7
                    </div>
                    {filteredOTC.map(pair => (
                      <button
                        key={pair}
                        onClick={() => addPair(pair)}
                        className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 shrink-0" />
                        {pair}
                      </button>
                    ))}
                  </>
                )}

                {/* Forex real */}
                {filteredReal.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[9px] text-slate-600 uppercase tracking-widest font-bold bg-white/5 border-y border-white/5">
                      Forex Real — Solo horario de mercado
                    </div>
                    {filteredReal.map(pair => (
                      <button
                        key={pair}
                        onClick={() => addPair(pair)}
                        className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-amber-500/10 hover:text-amber-300 flex items-center gap-2 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 shrink-0" />
                        {pair}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent>
            {/* Tags activos */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {activePairs.map(pair => (
                <div
                  key={pair}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition-all group ${
                    pair.includes('-OTC')
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />
                  {pair}
                  <button
                    onClick={() => removePair(pair)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 ml-1"
                    title="Eliminar par"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {activePairs.length === 0 && (
                <p className="text-[11px] text-slate-600 italic self-center">
                  Sin pares activos. Busca y agrega al menos uno.
                </p>
              )}
            </div>
            <p className="text-[9px] text-slate-600 mt-3 italic">
              🟢 OTC (24/7) · 🟡 Forex real (horario de mercado) · Pasa el cursor sobre un par para eliminarlo.
            </p>
          </CardContent>
        </Card>

        {/* ── Botón guardar ─────────────────────────────────────────── */}
        <div className="flex justify-center pt-4 pb-12">
          <Button
            onClick={handleSave}
            disabled={saving || paramsLoading || activePairs.length === 0}
            className="bg-primary hover:bg-primary/90 text-white h-14 px-12 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(38,166,154,0.25)] gap-3 transition-all hover:scale-105 active:scale-95"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar Protocolos de Riesgo
          </Button>
        </div>

        {/* ── Info cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/20 rounded-lg shrink-0">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase mb-1">Encripción de Seguridad</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Estos parámetros se inyectan directamente en el núcleo HFT de Render. La IA ajusta su comportamiento en el siguiente tick del mercado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-secondary/20 rounded-lg shrink-0">
                  <Zap className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase mb-1">Martingale V7.1</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Multiplicador actual:{' '}
                    <span className="font-bold text-secondary font-mono">{formData.martingaleMultiplier}x</span>.
                    Use con precaución en cuentas con balance menor a $1,000 USD.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
