'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBotEngine } from '@/components/dashboard/bot-engine-provider';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Coins, Search, Check, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DynamicPairSelector() {
  const { availablePairs, bridgeOnline, activePairs, refreshPairs } = useBotEngine();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  
  // Sync selected pairs with activePairs when loaded
  useEffect(() => {
    if (activePairs.length > 0) {
      setSelectedPairs(activePairs);
    }
  }, [activePairs]);

  // Auto-retry si no hay pares después de 3 segundos
  useEffect(() => {
    if (availablePairs.length === 0 && bridgeOnline) {
      const timer = setTimeout(() => {
        refreshPairs();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [availablePairs.length, bridgeOnline, refreshPairs]);

  const filteredPairs = availablePairs.filter(p => 
    p.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePair = (pair: string) => {
    setSelectedPairs(prev => {
      if (prev.includes(pair)) {
        return prev.filter(p => p !== pair);
      } else {
        return [...prev, pair];
      }
    });
  };

  const savePairs = async () => {
    if (!user || !firestore) return;
    if (selectedPairs.length === 0) {
      toast({ title: "Atención", description: "Debes seleccionar al menos un par", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ref = doc(firestore, 'users', user.uid, 'config', 'bot_params');
      await updateDoc(ref, { pairs: selectedPairs });
      toast({
        title: "Activos Actualizados",
        description: `El bot ahora operará en ${selectedPairs.length} activos.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (!bridgeOnline) {
    return null; // Solo mostramos esto si el broker está conectado
  }

  return (
    <Card className="bg-card/50 border-white/5 backdrop-blur-xl mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="h-5 w-5 text-amber-500" />
          Selector Dinámico de Activos
          <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500/50 bg-amber-500/10 text-[9px] uppercase">Peligro - Filtros Apagados</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Selecciona exactamente en qué activos (incluyendo Stocks/Criptos exóticas) debe operar el Consejo IA. 
          <span className="text-amber-500 font-bold ml-1">Usar bajo tu propio riesgo.</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar activo (Ej: Snap Inc. (OTC), SHIB...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/5 border-white/10"
            />
          </div>
          <Button onClick={savePairs} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white font-bold w-32">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar Cambios"}
          </Button>
        </div>

        {availablePairs.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mb-4 opacity-50" />
            <p className="mb-4">Leyendo lista completa de activos del broker...</p>
            <Button onClick={refreshPairs} variant="outline" className="border-white/20 text-xs h-8">
              Forzar Actualización
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-48 border border-white/5 rounded-xl bg-black/20 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {filteredPairs.map(pair => {
                const isSelected = selectedPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-all border ${
                      isSelected 
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                        : 'bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate pr-2">{pair}</span>
                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
              {filteredPairs.length === 0 && (
                <div className="col-span-full text-center p-4 text-muted-foreground text-xs">
                  No se encontraron activos con ese nombre
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
