
'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { errorEmitter } from '@/firebase/error-emitter';

export function EquityChart() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [data, setData] = useState<any[]>([]);

  const brokerRef = user && firestore ? doc(firestore, 'users', user.uid, 'config', 'broker') : null;
  const { data: brokerConfig } = useDoc(brokerRef as any);
  const accountType = brokerConfig?.accountType || 'demo';

  // Obtener estadísticas para el balance actual
  const statsRef = user && firestore ? doc(firestore, 'users', user.uid, 'trading_stats', accountType) : null;
  const { data: tradingStats } = useDoc(statsRef as any);

  useEffect(() => {
    if (!firestore || !user) return;

    // Consultamos el rendimiento específico del usuario y del tipo de cuenta
    const q = query(
      collection(firestore, 'users', user.uid, `rendimiento_${accountType}`), 
      orderBy('date', 'asc'), 
      limit(30)
    );
    
    const unsub = onSnapshot(
      q, 
      (snapshot) => {
        let records = snapshot.docs.map(docSnapshot => {
          const docData = docSnapshot.data();
          return {
            date: new Date(docData.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
            equity: docData.equity
          };
        });
        
        // Si el historial está vacío (cuenta nueva), mostrar al menos el balance actual como punto de partida
        if (records.length === 0 && tradingStats?.balance !== undefined) {
            records = [
              { date: 'Inicio', equity: tradingStats.balance },
              { date: 'Actual', equity: tradingStats.balance }
            ];
        } else if (records.length === 1) {
            records.push({ date: 'Actual', equity: records[0].equity });
        }
        
        setData(records);
      },
      (serverError) => {
        console.warn("Esperando datos de rendimiento...");
      }
    );
    return () => unsub();
  }, [firestore, user, accountType, tradingStats?.balance]);

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 border-white/5 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-lg font-headline">Curva de Equidad Dinámica</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px'
                }}
                labelStyle={{ color: 'hsl(var(--primary))' }}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorEquity)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
