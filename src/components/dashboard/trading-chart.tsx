'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

interface TradingChartProps {
  data: any[];
  pair: string;
}

export function TradingChart({ data, pair }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;

    if (data && data.length > 0) {
      candleSeries.setData(data);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return (
    <div className="relative w-full h-full bg-black/20 rounded-xl overflow-hidden border border-white/5">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/10 px-2 py-1 rounded">
                LIVE: {pair}
            </span>
        </div>
        <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
