'use client';

import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

interface TradingChartProps {
  data?: any[]; // Mantenido para compatibilidad de type, aunque el widget usa su propio feed
  pair: string;
}

export function TradingChart({ pair }: TradingChartProps) {
  // Formatear el par para TradingView (Remover -OTC si existe y usar un symbol válido)
  const tvPair = pair ? pair.replace('-OTC', '') : 'EURUSD';
  const symbol = `FX:${tvPair}`;

  return (
    <div className="relative w-full h-full bg-[#131722] overflow-hidden border border-white/5 rounded-none">
      <AdvancedRealTimeChart 
        theme="dark"
        symbol={symbol}
        locale="es"
        interval="1"
        timezone="Etc/UTC"
        style="1" // 1 = Candles
        hide_top_toolbar={false}
        hide_legend={false}
        save_image={false}
        container_id="tradingview_v7_master"
        autosize={true}
        enable_publishing={false}
        allow_symbol_change={true}
      />
    </div>
  );
}
