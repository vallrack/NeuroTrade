'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, where, addDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { exportReportToExcel } from '@/lib/export-excel';

export function AuditReports() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const brokerRef = useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid, 'config', 'broker');
  }, [user, firestore]);
  const { data: brokerConfig } = useDoc(brokerRef);

  const reportsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'reports'),
      orderBy('date', 'desc')
    );
  }, [user, firestore]);

  const { data: allReports, loading } = useCollection(reportsQuery);

  const reports = useMemo(() => {
    if (!allReports) return [];
    return allReports.filter((r: any) => r.accountType === (brokerConfig?.accountType || 'demo'));
  }, [allReports, brokerConfig]);

  const handleExport = (report: any) => {
    exportReportToExcel(report);
  };

  const processChartData = (hourlyStats: any) => {
    if (!hourlyStats) return [];
    return Object.keys(hourlyStats).sort().map(hour => ({
      hour,
      Ganadas: hourlyStats[hour].wins,
      Perdidas: hourlyStats[hour].losses,
      Profit: hourlyStats[hour].profit
    }));
  };
  const handleRecoverReport = async () => {
    if (!user || !firestore) return;
    try {
      const tradesQ = query(collection(firestore, 'users', user.uid, 'trades'));
      const snap = await getDocs(tradesQ);
      let totalProfit = 0, wins = 0, losses = 0;
      let hourlyStats: any = {};
      let pairStats: any = {};
      
      const todayString = new Date().toLocaleDateString();

      snap.forEach(d => {
        const t = d.data();
        if (t.accountType === (brokerConfig?.accountType || 'demo')) {
          const tradeDateStr = new Date(t.timestamp || 0).toLocaleDateString();
          
          if (tradeDateStr === todayString) {
            totalProfit += (t.profit || 0);
            const isWin = (t.profit > 0);
            const isLoss = (t.profit < 0);
            
            if (isWin) wins++;
            if (isLoss) losses++;
            
            const date = new Date(t.timestamp);
            const hourKey = date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }) + ':00';
            
            if (!hourlyStats[hourKey]) hourlyStats[hourKey] = { wins: 0, losses: 0, profit: 0 };
            hourlyStats[hourKey].wins += (isWin ? 1 : 0);
            hourlyStats[hourKey].losses += (isLoss ? 1 : 0);
            hourlyStats[hourKey].profit += (t.profit || 0);

            if (!pairStats[t.pair]) pairStats[t.pair] = { wins: 0, losses: 0, profit: 0 };
            pairStats[t.pair].wins += (isWin ? 1 : 0);
            pairStats[t.pair].losses += (isLoss ? 1 : 0);
            pairStats[t.pair].profit += (t.profit || 0);
          }
        }
      });
      if (wins > 0 || losses > 0) {
        await addDoc(collection(firestore, 'users', user.uid, 'reports'), {
          date: new Date().toISOString(),
          type: 'manual_disconnect',
          planDay: brokerConfig?.planDay || 1,
          planPhase: brokerConfig?.planPhase || 1,
          accountType: brokerConfig?.accountType || 'demo',
          profit: totalProfit,
          profitPercent: 0,
          finalBalance: 0,
          trades: wins + losses,
          wins, losses, hourlyStats, pairStats
        });
        alert('¡Reporte generado! Revisa los gráficos (puede tardar unos segundos).');
      } else {
        alert('No se encontraron operaciones de hoy para la cuenta ' + (brokerConfig?.accountType || 'demo'));
      }
    } catch (err: any) {
      alert('Error interno: ' + err.message);
    }
  };

  if (loading) return <div className="animate-pulse p-4">Cargando reportes de eficiencia...</div>;
  if (reports.length === 0) {
    return (
      <div className="space-y-4 mt-8">
        <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Reportes de Eficiencia (Plan 15 Días)
        </h3>
        <Card className="border-dashed border-white/20 bg-transparent flex flex-col items-center justify-center p-12 gap-4">
          <AlertTriangle className="h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Aún no hay reportes generados para esta fase.</p>
          <Button onClick={handleRecoverReport} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 mt-2">
            Generar Reporte del Día (Recuperación)
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-8">
      <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5" />
        Reportes de Eficiencia (Plan 15 Días)
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {reports.map((r: any) => (
            <Card 
              key={r.id} 
              className={`cursor-pointer transition-all hover:bg-white/5 ${selectedReport?.id === r.id ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(38,166,154,0.2)]' : 'border-white/10'}`}
              onClick={() => setSelectedReport(r)}
            >
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm">Fase {r.planPhase} - Día {r.planDay}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${r.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${r.profit?.toFixed(2)}
                  </div>
                  <div className={`text-xs ${
                    (r.profitPercent || 0) > 0 ? 'text-green-400' : 
                    (r.profitPercent || 0) < 0 ? 'text-red-400' : 'text-muted-foreground'
                  }`}>
                    Crecimiento: {(r.profitPercent || 0).toFixed(1)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedReport ? (
            <Card className="border-primary/20 bg-card/50 backdrop-blur-md h-full">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <CardTitle>Análisis Horario: Día {selectedReport.planDay}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Precisión: {selectedReport.trades > 0 ? Math.round((selectedReport.wins/selectedReport.trades)*100) : 0}% | Operaciones: {selectedReport.trades}</p>
                </div>
                <Button onClick={() => handleExport(selectedReport)} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-9">
                  <Download className="h-4 w-4" /> Exportar a Excel
                </Button>
              </CardHeader>
              <CardContent className="pt-6 h-[300px]">
                {selectedReport.hourlyStats && Object.keys(selectedReport.hourlyStats).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processChartData(selectedReport.hourlyStats)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="hour" stroke="#ffffff50" fontSize={12} />
                      <YAxis stroke="#ffffff50" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000000dd', borderColor: '#333' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend />
                      <Bar dataKey="Ganadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Perdidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <AlertTriangle className="h-10 w-10 mb-2" />
                    <p>No hay desglose horario para este reporte.</p>
                  </div>
                )}
              </CardContent>
              
              {/* Sección Semáforo de Divisas */}
              {selectedReport.pairStats && Object.keys(selectedReport.pairStats).length > 0 && (
                <div className="p-6 border-t border-white/5 bg-black/10">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Semáforo de Divisas</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(selectedReport.pairStats).sort((a: any, b: any) => b[1].profit - a[1].profit).map(([pair, stats]: [string, any]) => {
                      const isGood = stats.profit > 0;
                      const isBad = stats.profit < 0;
                      
                      return (
                        <div key={pair} className={`p-3 rounded-lg border ${
                          isGood ? 'bg-green-500/10 border-green-500/20' : 
                          isBad ? 'bg-red-500/10 border-red-500/20' : 
                          'bg-amber-500/10 border-amber-500/20'
                        }`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold">{pair}</span>
                            <div className={`h-2.5 w-2.5 rounded-full shadow-lg ${
                              isGood ? 'bg-green-500 shadow-green-500/50' : 
                              isBad ? 'bg-red-500 shadow-red-500/50' : 
                              'bg-amber-500 shadow-amber-500/50'
                            }`} />
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground">{stats.wins}W / {stats.losses}L</span>
                            <span className={`font-bold ${isGood ? 'text-green-500' : isBad ? 'text-red-500' : 'text-amber-500'}`}>
                              {isGood ? '+' : ''}{stats.profit.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="h-full min-h-[300px] border-white/5 flex items-center justify-center bg-black/20">
              <p className="text-muted-foreground font-code text-sm">Selecciona un reporte en el panel izquierdo para visualizar su gráfica.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
