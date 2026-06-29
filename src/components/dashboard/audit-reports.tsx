'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, FileSpreadsheet, AlertTriangle, Edit3, Trash2 } from 'lucide-react';
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
    return allReports
      .filter((r: any) => r.accountType === (brokerConfig?.accountType || 'demo'))
      .sort((a: any, b: any) => (a.planDay || 0) - (b.planDay || 0));
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
      
      const dayStr = window.prompt("¿Para qué día quieres generar este reporte de recuperación? (Ejemplo: 2)", String(brokerConfig?.planDay || 1));
      if (dayStr === null) return;
      const planDayToSave = parseInt(dayStr, 10) || brokerConfig?.planDay || 1;

      const phaseStr = window.prompt("¿Para qué fase es este reporte? (Ejemplo: 1)", String(brokerConfig?.planPhase || 1));
      if (phaseStr === null) return;
      const planPhaseToSave = parseInt(phaseStr, 10) || brokerConfig?.planPhase || 1;

      const todayString = new Date().toLocaleDateString();

      let latestTradeTime = 0;
      let finalBalance = 0;

      snap.forEach(d => {
        const t = d.data();
        if (t.accountType === (brokerConfig?.accountType || 'demo')) {
          const tradeDateStr = new Date(t.timestamp || 0).toLocaleDateString();
          
          if (tradeDateStr === todayString) {
            totalProfit += (t.profit || 0);
            const isWin = (t.profit > 0);
            const isLoss = (t.profit < 0);
            
            if (t.balance && new Date(t.timestamp).getTime() > latestTradeTime) {
              latestTradeTime = new Date(t.timestamp).getTime();
              finalBalance = t.balance;
            }
            
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

      let profitPercent = 0;
      if (finalBalance > 0) {
        const startBalance = finalBalance - totalProfit;
        if (startBalance > 0) {
          profitPercent = (totalProfit / startBalance) * 100;
        }
      }

      if (wins > 0 || losses > 0) {
        await addDoc(collection(firestore, 'users', user.uid, 'reports'), {
          date: new Date().toISOString(),
          type: 'manual_disconnect',
          planDay: planDayToSave,
          planPhase: planPhaseToSave,
          accountType: brokerConfig?.accountType || 'demo',
          profit: totalProfit,
          profitPercent,
          finalBalance,
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

  const handleFixGrowth = async (e: React.MouseEvent, r: any) => {
    e.stopPropagation();
    if (!firestore || !user) return;
    const balanceStr = window.prompt(`Ingresa el SALDO INICIAL exacto que tenías en tu cuenta esta mañana antes de empezar a operar. Esto nos permitirá calcular el porcentaje de crecimiento real sobre tu resultado de $${r.profit.toFixed(2)}:`, "10000");
    if (!balanceStr) return;
    const startBalance = parseFloat(balanceStr.replace(/[^0-9.-]+/g,""));
    if (isNaN(startBalance) || startBalance <= 0) {
      alert("Saldo inválido.");
      return;
    }
    const profitPercent = (r.profit / startBalance) * 100;
    try {
      await updateDoc(doc(firestore, 'users', user.uid, 'reports', r.id), {
        profitPercent,
        finalBalance: startBalance + r.profit
      });
      alert(`¡Crecimiento corregido al ${profitPercent.toFixed(2)}%!`);
    } catch(err: any) {
      alert("Error actualizando: " + err.message);
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
          <p className="text-muted-foreground">Aún no hay reportes generados para esta cuenta.</p>
          <Button onClick={handleRecoverReport} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 mt-2">
            Generar Reporte del Día (Recuperación)
          </Button>
        </Card>
      </div>
    );
  }

  const currentPhase = brokerConfig?.planPhase || 1;
  const phaseReports = reports.filter((r: any) => r.planPhase === currentPhase);
  const totalPhaseProfit = phaseReports.reduce((sum: number, r: any) => sum + (r.profit || 0), 0);
  const phaseTotalWins = phaseReports.reduce((sum: number, r: any) => sum + (r.wins || 0), 0);
  const phaseTotalLosses = phaseReports.reduce((sum: number, r: any) => sum + (r.losses || 0), 0);
  const phaseWinrate = phaseTotalWins + phaseTotalLosses > 0 
    ? ((phaseTotalWins / (phaseTotalWins + phaseTotalLosses)) * 100).toFixed(1) 
    : '0.0';

  const aggregatedHourlyStats: any = {};
  const aggregatedPairStats: any = {};

  phaseReports.forEach((r: any) => {
    if (r.hourlyStats) {
      Object.keys(r.hourlyStats).forEach(hour => {
        if (!aggregatedHourlyStats[hour]) aggregatedHourlyStats[hour] = { wins: 0, losses: 0, profit: 0 };
        aggregatedHourlyStats[hour].wins += (r.hourlyStats[hour].wins || 0);
        aggregatedHourlyStats[hour].losses += (r.hourlyStats[hour].losses || 0);
        aggregatedHourlyStats[hour].profit += (r.hourlyStats[hour].profit || 0);
      });
    }
    if (r.pairStats) {
      Object.keys(r.pairStats).forEach(pair => {
        if (!aggregatedPairStats[pair]) aggregatedPairStats[pair] = { wins: 0, losses: 0, profit: 0 };
        aggregatedPairStats[pair].wins += (r.pairStats[pair].wins || 0);
        aggregatedPairStats[pair].losses += (r.pairStats[pair].losses || 0);
        aggregatedPairStats[pair].profit += (r.pairStats[pair].profit || 0);
      });
    }
  });

  const globalReport = {
    id: 'global-phase-' + currentPhase,
    planDay: `Global (Fase ${currentPhase})`,
    trades: phaseTotalWins + phaseTotalLosses,
    wins: phaseTotalWins,
    losses: phaseTotalLosses,
    hourlyStats: aggregatedHourlyStats,
    pairStats: aggregatedPairStats
  };

  // Seleccionar automáticamente el reporte global si no hay nada seleccionado
  if (!selectedReport && phaseReports.length > 0) {
    setSelectedReport(globalReport);
  }

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-headline font-bold text-primary flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Reportes de Eficiencia (Plan 15 Días)
        </h3>
        <Button onClick={handleRecoverReport} variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
          🛠️ Recuperar Reporte Perdido
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {/* Tarjeta de Resumen de Fase */}
          <Card 
            className={`cursor-pointer transition-all hover:bg-white/5 ${selectedReport?.id === globalReport.id ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(38,166,154,0.2)]' : 'bg-primary/5 border-primary/20'}`}
            onClick={() => setSelectedReport(globalReport)}
          >
            <CardContent className="p-4">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Progreso Global de Fase {currentPhase}</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-black/30 p-2 rounded-md">
                  <div className="text-[10px] text-muted-foreground uppercase">Días Completados</div>
                  <div className="font-bold text-sm">{phaseReports.length} / 5</div>
                </div>
                <div className="bg-black/30 p-2 rounded-md">
                  <div className="text-[10px] text-muted-foreground uppercase">Winrate General</div>
                  <div className="font-bold text-sm">{phaseWinrate}%</div>
                </div>
              </div>
              <div className="bg-black/30 p-2 rounded-md flex justify-between items-center">
                <div className="text-[10px] text-muted-foreground uppercase">Profit Acumulado Fase</div>
                <div className={`font-bold text-sm ${totalPhaseProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPhaseProfit >= 0 ? '+' : ''}${totalPhaseProfit.toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de reportes */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
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
                  <div className={`text-xs flex items-center justify-end gap-1 ${
                    (r.profitPercent || 0) > 0 ? 'text-green-400' : 
                    (r.profitPercent || 0) < 0 ? 'text-red-400' : 'text-muted-foreground'
                  }`}>
                    Crecimiento: {(r.profitPercent || 0).toFixed(1)}%
                    {r.profit !== 0 && (r.profitPercent || 0) === 0 && (
                      <button 
                        onClick={(e) => handleFixGrowth(e, r)} 
                        title="Calcular Crecimiento %" 
                        className="hover:text-white transition-colors opacity-50 hover:opacity-100 p-1"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm("¿Seguro que deseas eliminar este reporte?")) {
                          try {
                            if (!user) return;
                            await deleteDoc(doc(firestore, 'users', user.uid, 'reports', r.id));
                            if (selectedReport?.id === r.id) setSelectedReport(null);
                          } catch (err: any) {
                            alert("Error eliminando: " + err.message);
                          }
                        }
                      }}
                      title="Eliminar Reporte" 
                      className="text-red-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100 p-1 ml-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedReport ? (
            <Card className="border-primary/20 bg-card/50 backdrop-blur-md h-full">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <div className="flex-1 mr-4">
                  <CardTitle className="mb-3">Análisis Horario: {String(selectedReport.planDay).includes('Global') ? '' : 'Día '}{selectedReport.planDay}</CardTitle>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider font-semibold">
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                      Trades: {selectedReport.trades || 0}
                    </span>
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md">
                      Ganadas: {selectedReport.wins || 0}
                    </span>
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                      Perdidas: {selectedReport.losses || 0}
                    </span>
                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-md">
                      Precisión: {selectedReport.trades > 0 ? Math.round(((selectedReport.wins || 0) / selectedReport.trades) * 100) : 0}%
                    </span>
                    <span className={`px-2 py-1 border rounded-md font-bold ${
                      (selectedReport.profit || 0) >= 0 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      Beneficio: {(selectedReport.profit || 0) >= 0 ? '+' : ''}${(selectedReport.profit || 0).toFixed(2)}
                    </span>
                  </div>
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
