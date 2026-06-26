'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
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

  if (loading) return <div className="animate-pulse p-4">Cargando reportes de eficiencia...</div>;
  if (reports.length === 0) return null;

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
                  <div className="text-xs text-green-400">Meta: {r.profitPercent?.toFixed(1)}%</div>
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
