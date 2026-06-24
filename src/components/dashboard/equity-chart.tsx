
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

    // Consultamos los últimos 50 trades
    const q = query(
      collection(firestore, 'users', user.uid, 'trades'), 
      orderBy('timestamp', 'desc'), 
      limit(50)
    );
    
    const unsub = onSnapshot(
      q, 
      (snapshot) => {
        // Filtrar localmente por accountType para no requerir un índice compuesto
        const allTrades = snapshot.docs.map(d => d.data());
        const filtered = allTrades.filter(t => t.accountType === accountType);
        
        // Están en orden descendente (el más reciente primero)
        let currentBalance = tradingStats?.balance || 0;
        
        const records = [];
        
        // Construimos la curva hacia atrás
        for (let i = 0; i < filtered.length; i++) {
          const t = filtered[i];
          records.unshift({
            date: new Date(t.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            equity: currentBalance
          });
          currentBalance -= (t.profit || 0);
        }
        
        // Agregar el punto de inicio
        records.unshift({
          date: 'Inicio',
          equity: currentBalance
        });
        
        setData(records);
      },
      (serverError) => {
        console.warn("Esperando datos de trades...");
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
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0}/>
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500}}
                dy={10}
                minTickGap={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500}}
                dx={-10}
                tickFormatter={(value) => `$${value}`}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '5 5' }}
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  borderColor: 'hsl(var(--primary)/0.3)',
                  borderRadius: '12px',
                  fontSize: '13px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(10px)'
                }}
                itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equidad']}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorEquity)" 
                animationDuration={1500}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: '#000', strokeWidth: 2, filter: 'url(#glow)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
