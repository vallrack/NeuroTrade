'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

interface TradingChartProps {
  data: any[];
  pair: string;
}

export function TradingChart({ data, pair }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null); // Referencia Histograma de Volumen

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
        mode: 1, // Magnet mode
        vertLine: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
          style: 3, 
          labelBackgroundColor: '#26a69a',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
          style: 3,
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
        secondsVisible: false, 
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',       
      downColor: '#ef5350',     
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });

    // Añadir el histograma de volumen abajo simulando estilo TradingView
    const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay encima de las velas
    });

    volumeSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.8, // volumen comprimido al último 20%
            bottom: 0,
        },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

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
  }, []);

  const isDataLoadedRef = useRef(false);

  // Al cambiar de par, forzar recarga completa (setData) en vez de update(),
  // para no mezclar velas de pares distintos.
  useEffect(() => {
    isDataLoadedRef.current = false;
  }, [pair]);

  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    if (seriesRef.current && volumeSeriesRef.current && data && data.length > 0) {
      try {
        // Velas
        const formattedData = data.map(candle => {
          let t = candle.time || candle.from || candle.timestamp || candle.id;
          if (t > 1000000000000) t = Math.floor(t / 1000); // Convert from ms to s if needed
          return {
            time: t,
            open: candle.open,
            high: candle.max !== undefined ? candle.max : candle.high,
            low: candle.min !== undefined ? candle.min : candle.low,
            close: candle.close,
          };
        });
        formattedData.sort((a, b) => (a.time as number) - (b.time as number));

        // Volumen
        const formattedVolumeData = data.map(candle => {
          let t = candle.time || candle.from || candle.timestamp || candle.id;
          if (t > 1000000000000) t = Math.floor(t / 1000);
          return {
            time: t,
            value: candle.volume || 0,
            color: candle.close > candle.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)'
          };
        });
        formattedVolumeData.sort((a, b) => (a.time as number) - (b.time as number));

        if (!isDataLoadedRef.current) {
          seriesRef.current.setData(formattedData);
          volumeSeriesRef.current.setData(formattedVolumeData);
          chartRef.current?.timeScale().fitContent();
          isDataLoadedRef.current = true;
        } else {
          try {
            const lastCandle = formattedData[formattedData.length - 1];
            const lastVolume = formattedVolumeData[formattedVolumeData.length - 1];
            if (lastCandle) seriesRef.current.update(lastCandle);
            if (lastVolume) volumeSeriesRef.current.update(lastVolume);
          } catch (err) {
            seriesRef.current.setData(formattedData);
            volumeSeriesRef.current.setData(formattedVolumeData);
          }
        }
        setChartError(null);
      } catch (err: any) {
        console.error("TradingChart Error:", err, data);
        setChartError(err.message || String(err));
      }
    }
  }, [data]);

  return (
    <div className="relative w-full h-full bg-[#131722] rounded-none overflow-hidden border-0">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] bg-primary/10 px-2.5 py-1 rounded shadow-[0_0_15px_rgba(38,166,154,0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#26a69a]" />
                IQ OTC: {pair}
            </span>
        </div>
        {chartError && (
          <div className="absolute inset-0 z-50 bg-red-900/90 flex items-center justify-center p-4">
            <div className="text-white text-xs font-mono">
              Error rendering chart: {chartError}<br/><br/>
              Data length: {data?.length}
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
