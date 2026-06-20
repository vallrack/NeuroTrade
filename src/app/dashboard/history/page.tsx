
'use client';

import { useMemo } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { History, ArrowUpRight, ArrowDownRight, Clock, DollarSign } from 'lucide-react';

export default function HistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const brokerRef = user ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef);
  const currentAccountType = brokerConfig?.accountType || 'demo';

  const tradesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    // FILTRO DINÁMICO: Solo mostramos trades del canal activo (Demo o Real)
    return query(
      collection(firestore, 'users', user.uid, 'trades'),
      where('accountType', '==', currentAccountType),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }, [user, firestore, currentAccountType]);

  const { data: trades, loading } = useCollection(tradesQuery);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-6 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger />
          <h1 className="ml-4 font-headline text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Auditoría {currentAccountType.toUpperCase()}
          </h1>
        </header>

        <main className="p-6 space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-headline font-bold">Registro de Ejecución</h2>
            <p className="text-sm text-muted-foreground italic">Auditoría transparente del canal {currentAccountType.toUpperCase()}.</p>
          </div>

          <Card className="bg-card/50 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Últimas 50 Operaciones ({currentAccountType.toUpperCase()})</CardTitle>
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
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="text-right">Beneficio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade: any) => (
                      <TableRow key={trade.id} className="hover:bg-white/5 transition-colors border-white/5">
                        <TableCell className="text-xs font-code">
                          {new Date(trade.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-bold">{trade.pair}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {trade.direction === 'CALL' ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                            <span className={trade.direction === 'CALL' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                              {trade.direction}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-code">${trade.amount}</TableCell>
                        <TableCell>
                          <Badge variant={trade.status === 'win' ? 'default' : 'destructive'} className="uppercase text-[10px]">
                            {trade.status === 'win' ? 'Profit' : 'Loss'}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { doc } from 'firebase/firestore';
