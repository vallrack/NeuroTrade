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

  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa', // zinc-400
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 450,
      crosshair: {
        mode: 1, // Magnet mode or Normal
        vertLine: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
          style: 3, // Dashed
          labelBackgroundColor: '#26a69a',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
          style: 3, // Dashed
          labelBackgroundColor: '#26a69a',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false, // Cleaner
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',       // Teal-400
      downColor: '#ef5350',     // Red-400
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []); // Solo se crea una vez al montar

  const isDataLoadedRef = useRef(false);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      // Traducir formato IQ Option a formato Lightweight Charts
      const formattedData = data.map(candle => ({
        time: candle.from,
        open: candle.open,
        high: candle.max,
        low: candle.min,
        close: candle.close,
      }));

      // Ordenar por tiempo (vital para lightweight-charts)
      formattedData.sort((a, b) => (a.time as number) - (b.time as number));

      if (!isDataLoadedRef.current) {
        // Carga inicial completa
        seriesRef.current.setData(formattedData);
        chartRef.current?.timeScale().fitContent();
        isDataLoadedRef.current = true;
      } else {
        // En tiempo real: aplicamos update SOLAMENTE a la vela viva actual
        // Lightweight Charts lanza error crítico si se intenta hacer update a una vela anterior
        try {
          const lastCandle = formattedData[formattedData.length - 1];
          // Solo si existe la vela
          if (lastCandle) {
             seriesRef.current.update(lastCandle);
          }
        } catch (err) {
          // Si el par cambió o el tiempo se desincronizó (Ej: cambio de activo)
          seriesRef.current.setData(formattedData);
        }
      }
    }
  }, [data]); // Se dispara cada vez que llega un nuevo tick o bloque de data

  return (
    <div className="relative w-full h-full bg-black/20 rounded-xl overflow-hidden border border-white/5">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/10 px-2.5 py-1 rounded shadow-[0_0_15px_rgba(38,166,154,0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#26a69a]" />
                LIVE: {pair}
            </span>
        </div>
        <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
