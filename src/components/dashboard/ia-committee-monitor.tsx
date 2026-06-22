'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, Activity, Zap, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, query, collection, orderBy, limit } from 'firebase/firestore';
import { executeTrade } from '@/lib/actions';
import { bridgeAnalyze, getBridgeUrl, getBridgeModeLabel, type AnalyzeResponse } from '@/lib/bridge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { playSuccessChime, playAlarm } from '@/lib/sounds';
import { TradingChart } from './trading-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CommitteeData = {
  direction: 'CALL' | 'PUT' | 'NONE';
  probability: number;
  candles: AnalyzeResponse['candles'];
  balance: number;
  rsi?: number;
};

export function IACommitteeMonitor() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [data, setData] = useState<CommitteeData | null>(null);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const failureCount = useRef(0);

  const executionCooldown = useRef(false);
  const lastFetchTime = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  const botParamsRef = useMemo(() => {
    if (!mounted || !firestore) return null;
    return doc(firestore, 'configuracion', 'bot_params');
  }, [mounted, firestore]);
  const { data: botParams } = useDoc(botParamsRef);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const [selectedPair, setSelectedPair] = useState<string | null>(null);

  const activePair = selectedPair || botParams?.pairs?.[0] || 'EURUSD-OTC';
  const availablePairs = ['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC', 'AUDCAD-OTC', 'EURGBP-OTC', 'NZDUSD-OTC'];
  const currentAccountType = brokerConfig?.accountType || 'demo';
  const minConfidence = botParams?.min_confidence_score ?? 85;

  const statsRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'trading_stats', currentAccountType);
  }, [mounted, user, firestore, currentAccountType]);
  const { data: tradingStats } = useDoc(statsRef);

  const tradesQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'trades'), orderBy('timestamp', 'desc'), limit(3));
  }, [mounted, user, firestore]);
  const { data: recentTradesRaw } = useCollection(tradesQuery);
  const recentTrades = useMemo(() => {
    if (!recentTradesRaw) return [];
    return recentTradesRaw.filter((t: { accountType?: string }) => t.accountType === currentAccountType);
  }, [recentTradesRaw, currentAccountType]);

  const runGuardianCheck = useCallback((): boolean => {
    const balance = tradingStats?.balance ?? data?.balance ?? 0;
    const minBalance = botParams?.minBalance ?? 2000;
    if (balance < minBalance) {
      playAlarm();
      toast({ title: 'Guardián', description: `Saldo insuficiente ($${balance})`, variant: 'destructive' });
      return false;
    }
    const recentLosses = recentTrades.filter((t: { status?: string }) => t.status === 'loss').length;
    const maxLosses = botParams?.maxLosses ?? 2;
    if (recentLosses >= maxLosses) {
      playAlarm();
      toast({ title: 'Guardián', description: 'Límite de pérdidas consecutivas alcanzado', variant: 'destructive' });
      return false;
    }
    const dailyProfit = tradingStats?.dailyProfit ?? 0;
    const stopLoss = botParams?.stopLoss ?? 8000;
    if (dailyProfit <= -stopLoss) {
      playAlarm();
      toast({ title: 'Guardián', description: 'Stop loss diario alcanzado', variant: 'destructive' });
      return false;
    }
    return true;
  }, [tradingStats, data, botParams, recentTrades, toast]);

  const handleAutoTrade = useCallback(async (direction: 'CALL' | 'PUT') => {
    if (!user || isExecuting || executionCooldown.current) return;
    if (!runGuardianCheck()) return;

    setIsExecuting(true);
    executionCooldown.current = true;
    try {
      const result = await executeTrade(user.uid, {
        pair: activePair,
        direction,
        amount: botParams?.investmentPerTrade || 4000,
        accountType: currentAccountType,
        bridgeUrl: getBridgeUrl(),
      });
      if (result.success) {
        playSuccessChime();
        toast({
          title: `${direction} en ${activePair}`,
          description: `Resultado: ${result.status?.toUpperCase()} — $${result.profit}`,
        });
      } else {
        playAlarm();
        toast({ title: 'Error de ejecución', description: result.error, variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      playAlarm();
    } finally {
      setIsExecuting(false);
      setTimeout(() => { executionCooldown.current = false; }, 10000);
    }
  }, [user, isExecuting, activePair, botParams, currentAccountType, runGuardianCheck, toast]);

  useEffect(() => {
    if (!mounted || !user || !brokerConfig?.email || !brokerConfig?.password) return;
    let isMounted = true;

    const fetchData = async () => {
      const now = Date.now();
      if (now - lastFetchTime.current < 1200) return;
      lastFetchTime.current = now;

      try {
        const json = await bridgeAnalyze({
          email: brokerConfig.email,
          password: brokerConfig.password,
          pair: activePair,
          accountType: currentAccountType,
          minRsi: botParams?.minRsi ?? botParams?.midRsi ?? 38,
          maxRsi: botParams?.maxRsi ?? 62,
        });

        if (!isMounted) return;

        if (json.success) {
          setBridgeOnline(true);
          failureCount.current = 0; // Reset
          const direction = (json.direction === 'CALL' || json.direction === 'PUT')
            ? json.direction
            : 'NONE';
          const probability = json.probability ?? 50;

          setData({
            direction,
            probability,
            candles: json.candles || [],
            balance: json.balance ?? 0,
            rsi: json.rsi,
          });

          if (
            botParams?.bot_activo &&
            brokerConfig.status === 'connected' &&
            probability >= minConfidence &&
            (direction === 'CALL' || direction === 'PUT')
          ) {
            handleAutoTrade(direction);
          }
        } else {
          failureCount.current++;
          if (failureCount.current >= 3) setBridgeOnline(false);
        }
      } catch {
        if (isMounted) {
          failureCount.current++;
          if (failureCount.current >= 3) setBridgeOnline(false);
        }
      }
    };

    fetchData();
    const id = setInterval(fetchData, 1500);
    return () => { isMounted = false; clearInterval(id); };
  }, [
    mounted, user, activePair, botParams?.bot_activo, botParams?.minRsi, botParams?.midRsi,
    botParams?.maxRsi, brokerConfig?.email, brokerConfig?.password, brokerConfig?.status,
    currentAccountType, minConfidence, handleAutoTrade,
  ]);

  if (!mounted) return null;

  const isCall = data?.direction === 'CALL';
  const isPut = data?.direction === 'PUT';

  return (
    <div className="space-y-6">
      <Card className="bg-black/60 border-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent font-headline tracking-tight">
                V7 TERMINAL MAESTRO
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 font-mono text-[9px]">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] py-0',
                    bridgeOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : bridgeOnline === false
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                  )}
                >
                  {bridgeOnline ? `BRIDGE HFT ONLINE · ${getBridgeModeLabel()}` : bridgeOnline === false ? 'BRIDGE OFFLINE' : 'SYNC...'}
                </Badge>
                <Select value={activePair} onValueChange={setSelectedPair}>
                  <SelectTrigger className="h-5 border-0 bg-white/5 hover:bg-white/10 text-[9px] uppercase tracking-widest text-slate-300 px-2 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {availablePairs.map(p => (
                      <SelectItem key={p} value={p} className="text-[10px] uppercase font-mono">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end font-mono">
            <span className="text-[10px] text-slate-500 uppercase">Balance {currentAccountType}</span>
            <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_10px_#10b981]">
              ${data?.balance != null ? Number(data.balance).toLocaleString() : '---'}
            </span>
            {data?.rsi != null && (
              <span className="text-[9px] text-slate-500 mt-0.5">RSI {data.rsi.toFixed(1)}</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[480px] w-full bg-slate-950 relative border-b border-white/5">
            <TradingChart data={data?.candles || []} pair={activePair} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Consenso Algorítmico Quantum
                </h3>
                <span className={cn(
                  'text-lg font-black font-mono tracking-tighter',
                  isCall ? 'text-emerald-400' : isPut ? 'text-red-400' : 'text-slate-500'
                )}>
                  {data?.direction && data.direction !== 'NONE' ? data.direction : 'ANALIZANDO...'}
                </span>
              </div>

              <div className="relative pt-2">
                <Progress value={data?.probability || 0} className="h-2 bg-slate-800" />
                <div className="flex justify-between mt-2 font-mono">
                  <span className="text-[10px] text-indigo-400">PRECISIÓN V7 BRIDGE</span>
                  <span className="text-sm text-white font-bold">{data?.probability || 0}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">Ejecutor IA</span>
                <Badge className={cn(
                  'font-mono text-[10px]',
                  botParams?.bot_activo ? 'bg-emerald-500 text-black font-bold' : 'bg-slate-800 text-slate-500'
                )}>
                  {botParams?.bot_activo ? 'OFFICIAL ACTIVE' : 'MANUAL MODE'}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {!data?.direction || data.direction === 'NONE' ? (
                <div className="flex flex-col items-center justify-center p-8 border border-white/5 rounded-2xl bg-white/[0.02]">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <span className="text-[10px] text-slate-500 animate-pulse font-mono tracking-[0.2em] uppercase">
                    {bridgeOnline === false ? 'Puente no disponible — revise Broker Link' : 'Estableciendo vínculo seguro...'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {['QUANTUM-X', 'SENTINEL', 'V7-MAESTRO'].map((name) => (
                    <div key={name} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-white/5 hover:bg-slate-800/80 transition-all group">
                      <div className="flex items-center gap-3">
                        <Zap className={cn('w-4 h-4', isCall ? 'text-emerald-400' : isPut ? 'text-red-400' : 'text-slate-600')} />
                        <span className="text-[11px] font-bold text-slate-300 font-mono tracking-widest">{name}</span>
                      </div>
                      <Badge className={cn(
                        'text-[10px] font-mono border-0',
                        isCall ? 'bg-emerald-500/20 text-emerald-300' : isPut ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-slate-500'
                      )}>
                        {data.direction}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {botParams?.bot_activo && (
        <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-bottom-2 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] font-mono">
            Protección del Guardián Activa — IA en Modo Maestro Oficial
          </span>
        </div>
      )}
    </div>
  );
}
