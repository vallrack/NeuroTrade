
'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export function EquityChart() {
  const firestore = useFirestore();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, 'rendimiento_diario'), orderBy('date', 'asc'), limit(30));
    const unsub = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(docSnapshot => {
        const docData = docSnapshot.data();
        return {
          date: new Date(docData.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
          equity: docData.equity
        };
      });
      setData(records);
    });
    return () => unsub();
  }, [firestore]);

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
