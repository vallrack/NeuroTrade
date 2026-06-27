'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
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

import { ALL_REGULAR_PAIRS, ALL_OTC_PAIRS, ALL_CRYPTO_PAIRS, ALL_STOCKS } from '@/lib/market-schedule';

// Todos los pares disponibles combinados
const ALL_IQ_PAIRS = [
  ...ALL_OTC_PAIRS,
  ...ALL_REGULAR_PAIRS,
  ...ALL_CRYPTO_PAIRS,
  ...ALL_STOCKS,
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
    moneyManagementMode: 'fixed', // 'fixed' | 'compound' | 'martingale'
    investmentPerTrade: 500, // Fijo, o Inversión Inicial
    compoundPercentage: 5,   // % del saldo para interés compuesto
    martingaleMultiplier: 2.1,
    stopLoss: 8000,
    takeProfit: 10000,
    maxDailyTrades: 20,
    min_confidence_score: 85,
    reverseMode: 'off',
    manipulationVolMultiplier: 1.5,
    manipulationMaxBody: 0.3,
  });
  const [activePairs, setActivePairs] = useState<string[]>(['EURUSD-OTC', 'GBPUSD-OTC']);

  useEffect(() => { setMounted(true); }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'bot_params');
  }, [mounted, user, firestore]);

  const { data: botParams, loading: paramsLoading } = useDoc(botParamsRef);

  // Verificar rol del usuario (mismo patrón que app-sidebar)
  const profileRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [mounted, user, firestore]);
  const { data: profile } = useDoc(profileRef);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super-admin';

  useEffect(() => {
    if (botParams) {
      setFormData({
        moneyManagementMode: botParams.moneyManagementMode || 'fixed',
        investmentPerTrade: botParams.investmentPerTrade || 500,
        compoundPercentage: botParams.compoundPercentage || 5,
        martingaleMultiplier: botParams.martingaleMultiplier || 2.1,
        stopLoss: botParams.stopLoss || 8000,
        takeProfit: botParams.takeProfit || 10000,
        maxDailyTrades: botParams.maxDailyTrades || 20,
        min_confidence_score: botParams.min_confidence_score || 85,
        reverseMode: botParams.reverseMode || 'off',
        manipulationVolMultiplier: botParams.manipulationVolMultiplier || 1.5,
        manipulationMaxBody: botParams.manipulationMaxBody || 0.3,
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
  
  const filteredOTC  = filteredPairs.filter(p => ALL_OTC_PAIRS.includes(p));
  const filteredReal = filteredPairs.filter(p => ALL_REGULAR_PAIRS.includes(p));
  const filteredCrypto = filteredPairs.filter(p => ALL_CRYPTO_PAIRS.includes(p));
  const filteredStocks = filteredPairs.filter(p => ALL_STOCKS.includes(p));

  // Par personalizado que no existe en la lista
  const typedIsCustom =
    pairSearch.trim().length >= 3 &&
    !ALL_IQ_PAIRS.some(p => p.toLowerCase() === pairSearch.trim().toLowerCase()) &&
    !activePairs.includes(pairSearch.trim().toUpperCase());

  if (!mounted) return null;

  if (paramsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Cargando parámetros de riesgo...</p>
        </div>
      </div>
    );
  }

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
          {/* Gestión de Capital (Money Management) */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-primary/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Gestión de Capital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Estrategia M.M.</Label>
                <Select
                  value={formData.moneyManagementMode}
                  onValueChange={v => setFormData(p => ({ ...p, moneyManagementMode: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 h-10 font-bold text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="fixed">Interés Fijo (Tradicional)</SelectItem>
                    <SelectItem value="compound">Interés Compuesto</SelectItem>
                    <SelectItem value="martingale">Martingala (Recuperación)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.moneyManagementMode === 'fixed' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Inversión Fija ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                    <Input
                      type="number"
                      value={formData.investmentPerTrade}
                      onChange={e => handleInputChange('investmentPerTrade', e.target.value)}
                      className="bg-white/5 border-white/10 pl-8 h-10 font-mono text-lg font-bold text-white"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">El bot siempre invertirá este monto exacto.</p>
                </div>
              )}

              {formData.moneyManagementMode === 'compound' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Porcentaje del Saldo (%)</Label>
                  <div className="relative">
                    <Input
                      type="number" min="1" max="100"
                      value={formData.compoundPercentage}
                      onChange={e => handleInputChange('compoundPercentage', e.target.value)}
                      className="bg-white/5 border-white/10 pr-8 h-10 font-mono text-lg font-bold text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Ej: Si tienes $10,000 y pones 5%, invertirá $500.</p>
                </div>
              )}

              {formData.moneyManagementMode === 'martingale' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Inversión Base ($)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">$</span>
                      <Input
                        type="number"
                        value={formData.investmentPerTrade}
                        onChange={e => handleInputChange('investmentPerTrade', e.target.value)}
                        className="bg-white/5 border-white/10 pl-8 h-10 font-mono text-lg font-bold text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Multiplicador</Label>
                    <div className="relative">
                      <Input
                        type="number" step="0.1" min="1" max="3"
                        value={formData.martingaleMultiplier}
                        onChange={e => handleInputChange('martingaleMultiplier', e.target.value)}
                        className="bg-white/5 border-white/10 pr-8 h-10 font-mono text-lg font-bold text-purple-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">x</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Si pierde, multiplica la base por este factor para recuperar.</p>
                </div>
              )}
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

          {/* Modo Inverso */}
          <Card className="bg-black/40 border-white/5 backdrop-blur-xl group hover:border-purple-500/20 transition-all">
            <CardHeader className="pb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg w-fit mb-2">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400">Modo Inverso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 mt-2">
                <Label className="text-xs font-bold text-white uppercase tracking-wider">Estrategia Contrariana</Label>
                <Select
                  value={formData.reverseMode}
                  onValueChange={v => setFormData(prev => ({ ...prev, reverseMode: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-full">
                    <SelectValue placeholder="Seleccionar modo" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="off">Inactivo (Operación Normal)</SelectItem>
                    <SelectItem value="always">Siempre Inverso (100% Contrariano)</SelectItem>
                    <SelectItem value="auto">Inteligente (Auto-Detección de Manipulación)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                {formData.reverseMode === 'off' && "El bot opera a favor de la tendencia según los indicadores tradicionales."}
                {formData.reverseMode === 'always' && "Invierte TODAS las operaciones (CALL → PUT, PUT → CALL). Ideal para mercados fuertemente manipulados."}
                {formData.reverseMode === 'auto' && "El bot opera normal pero invierte la operación SOLO si la IA detecta una trampa de liquidez (mechas largas con alto volumen)."}
              </p>
            </CardContent>
          </Card>

          {/* Configuración Inteligente (Solo si está en Auto) */}
          {formData.reverseMode === 'auto' && (
            <Card className="bg-purple-900/10 border-purple-500/20 backdrop-blur-xl md:col-span-1 lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-purple-400">
                  Sensibilidad Anti-Manipulación
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Pico de Volumen (Múltiplo)</Label>
                  <div className="relative">
                    <Input
                      type="number" step="0.1" min="1.0" max="5.0"
                      value={formData.manipulationVolMultiplier}
                      onChange={e => handleInputChange('manipulationVolMultiplier', e.target.value)}
                      className="bg-white/5 border-white/10 h-10 font-mono text-sm text-purple-300 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">x</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Ej: 1.5x significa que el volumen debe ser 50% mayor al promedio.</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Tamaño Máx. del Cuerpo</Label>
                  <div className="relative">
                    <Input
                      type="number" step="0.05" min="0.05" max="1.0"
                      value={formData.manipulationMaxBody}
                      onChange={e => handleInputChange('manipulationMaxBody', e.target.value)}
                      className="bg-white/5 border-white/10 h-10 font-mono text-sm text-purple-300 pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">p</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Ej: 0.3 significa que el cuerpo debe ser menos del 30% del tamaño de la vela.</p>
                </div>
              </CardContent>
            </Card>
          )}
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

            {/* Buscador + Select manual */}
            <div className="flex flex-col sm:flex-row gap-3 relative">
              <div className="relative flex-1">
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

              {/* El Select de todos los pares categorizados */}
              <div className="w-full sm:w-64">
                <Select onValueChange={(val) => addPair(val)}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-11 text-slate-300 font-mono text-xs">
                    <SelectValue placeholder="Catálogo de Pares..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 max-h-72">
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-black/40">🛡️ Forex OTC (24/7)</SelectLabel>
                      {ALL_OTC_PAIRS.filter(p => !activePairs.includes(p)).map(p => (
                        <SelectItem key={p} value={p} className="font-mono text-[11px] text-slate-300 focus:bg-emerald-500/10 focus:text-white">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 shrink-0" /> {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-black/40 mt-1">🌍 Forex Normal</SelectLabel>
                      {ALL_REGULAR_PAIRS.filter(p => !activePairs.includes(p)).map(p => (
                        <SelectItem key={p} value={p} className="font-mono text-[11px] text-slate-300 focus:bg-blue-500/10 focus:text-white">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/50 shrink-0" /> {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>

                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-black/40 mt-1">🪙 Criptomonedas</SelectLabel>
                      {ALL_CRYPTO_PAIRS.filter(p => !activePairs.includes(p)).map(p => (
                        <SelectItem key={p} value={p} className="font-mono text-[11px] text-slate-300 focus:bg-amber-500/10 focus:text-white">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 shrink-0" /> {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>

                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold text-purple-500 uppercase tracking-wider bg-black/40 mt-1">📈 Acciones</SelectLabel>
                      {ALL_STOCKS.filter(p => !activePairs.includes(p)).map(p => (
                        <SelectItem key={p} value={p} className="font-mono text-[11px] text-slate-300 focus:bg-purple-500/10 focus:text-white">
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 shrink-0" /> {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
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

                {/* Lista Categorizada */}
                {filteredOTC.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-black/40 sticky top-0">🛡️ Forex OTC (24/7)</div>
                    {filteredOTC.map(p => (
                      <button key={p} onClick={() => addPair(p)} className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-emerald-500/10 hover:text-white flex items-center gap-2 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 shrink-0" />
                        {p}
                      </button>
                    ))}
                  </>
                )}
                
                {filteredReal.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-black/40 sticky top-0">🌍 Forex Normal (Mercado)</div>
                    {filteredReal.map(p => (
                      <button key={p} onClick={() => addPair(p)} className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-blue-500/10 hover:text-white flex items-center gap-2 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/50 shrink-0" />
                        {p}
                      </button>
                    ))}
                  </>
                )}

                {filteredCrypto.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-black/40 sticky top-0">🪙 Criptomonedas</div>
                    {filteredCrypto.map(p => (
                      <button key={p} onClick={() => addPair(p)} className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-amber-500/10 hover:text-white flex items-center gap-2 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50 shrink-0" />
                        {p}
                      </button>
                    ))}
                  </>
                )}

                {filteredStocks.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-purple-500 uppercase tracking-wider bg-black/40 sticky top-0">📈 Acciones y Materias Primas</div>
                    {filteredStocks.map(p => (
                      <button key={p} onClick={() => addPair(p)} className="w-full text-left px-4 py-2 text-[11px] font-mono text-slate-300 hover:bg-purple-500/10 hover:text-white flex items-center gap-2 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 shrink-0" />
                        {p}
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
