
'use client';



import { useMemo, useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where, doc } from 'firebase/firestore';
import { History, ArrowUpRight, ArrowDownRight, Clock, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuditReports } from '@/components/dashboard/audit-reports';

export default function HistoryPage() {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const brokerRef = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [mounted, user, firestore]);

  const { data: brokerConfig } = useDoc(brokerRef);
  const currentAccountType = brokerConfig?.accountType || 'demo';

  const tradesQuery = useMemo(() => {
    if (!mounted || !user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'trades'),
      limit(100)
    );
  }, [mounted, user, firestore]);

  const { data: allTrades, loading } = useCollection(tradesQuery);

  // Filtrado en el cliente y ordenamiento
  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = allTrades.filter((t: any) => t.accountType === currentAccountType);
    return filtered.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allTrades, currentAccountType]);

  const handleExportExcel = async () => {
    if (!trades || trades.length === 0) return;
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    const hourlyStats: Record<string, { wins: number, losses: number, profit: number }> = {};
    const pairStats: Record<string, { wins: number, losses: number, profit: number }> = {};

    trades.forEach((t: any) => {
      const isWin = t.status === 'win' || (t.profit && t.profit > 0);
      if (isWin) wins++; else losses++;
      const p = t.profit || 0;
      totalProfit += p;

      const d = new Date(t.timestamp);
      const hour = `${d.getHours().toString().padStart(2, '0')}:00`;
      
      if (!hourlyStats[hour]) hourlyStats[hour] = { wins: 0, losses: 0, profit: 0 };
      if (isWin) hourlyStats[hour].wins++; else hourlyStats[hour].losses++;
      hourlyStats[hour].profit += p;

      if (!pairStats[t.pair]) pairStats[t.pair] = { wins: 0, losses: 0, profit: 0 };
      if (isWin) pairStats[t.pair].wins++; else pairStats[t.pair].losses++;
      pairStats[t.pair].profit += p;
    });

    const mockReport = {
      date: new Date().toISOString(),
      planPhase: 'Auditoría',
      planDay: '50 Operaciones',
      accountType: currentAccountType,
      trades: trades.length,
      wins,
      losses,
      profit: totalProfit,
      profitPercent: 0,
      hourlyStats,
      pairStats
    };

    const { exportReportToExcel } = await import('@/lib/export-excel');
    await exportReportToExcel(mockReport);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <SidebarTrigger />
        <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Auditoría {currentAccountType.toUpperCase()}
        </h1>
      </header>

      <main className="p-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-headline font-bold text-primary animate-pulse">Registro Cuántico de Ejecución</h2>
          <p className="text-sm text-muted-foreground italic">Auditoría transparente e inmutable del canal {currentAccountType.toUpperCase()}.</p>
        </div>

        <Card className="bg-card/30 border border-primary/20 shadow-[0_0_15px_rgba(38,166,154,0.1)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
            <CardTitle className="text-lg">Últimas 50 Operaciones ({currentAccountType.toUpperCase()})</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-green-500/50 text-green-500 hover:bg-green-500/10 gap-2 font-bold text-xs uppercase tracking-widest">
              <Download className="h-3 w-3" />
              Exportar a Excel (Reporte Premium)
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground animate-pulse">Sincronizando historial...</div>
            ) : trades.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Sin operaciones en este canal.</p>
                <p className="text-xs">Asegúrate de que el bot esté activo en modo {currentAccountType.toUpperCase()}.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow>
                    <TableHead className="text-xs uppercase font-bold text-muted-foreground">Fecha/Hora</TableHead>
                    <TableHead className="text-xs uppercase font-bold text-muted-foreground">Activo</TableHead>
                    <TableHead className="text-xs uppercase font-bold text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs uppercase font-bold text-muted-foreground">Monto</TableHead>
                    <TableHead className="text-xs uppercase font-bold text-muted-foreground">Resultado</TableHead>
                    <TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Beneficio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade: any) => (
                    <TableRow key={trade.id} className="hover:bg-white/5 transition-colors border-white/5">
                      <TableCell className="text-xs font-code">
                        {trade.timestamp?.toDate ? trade.timestamp.toDate().toLocaleString() : new Date(trade.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-bold text-xs">{trade.pair}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {trade.direction === 'CALL' ? (
                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                          )}
                          <span className={cn(
                            "text-[10px] font-bold uppercase",
                            trade.direction === 'CALL' ? 'text-green-500' : 'text-red-500'
                          )}>
                            {trade.direction}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-code text-xs">${trade.amount}</TableCell>
                      <TableCell>
                        <Badge variant={trade.profit > 0 ? 'default' : (trade.profit < 0 ? 'destructive' : 'secondary')} className="uppercase text-[8px] font-bold tracking-tighter">
                          {trade.profit > 0 ? 'Profit' : (trade.profit < 0 ? 'Loss' : 'Tie')}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-code font-bold text-xs ${trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.profit >= 0 ? '+' : ''}${parseFloat(trade.profit).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AuditReports />
      </main>
    </>
  );
}

import { cn } from '@/lib/utils';
