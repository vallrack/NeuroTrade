'use server';
/**
 * @fileOverview Núcleo de Consenso V7 - Traducción de Estrategia Python
 * Incluye filtros de ADX, EMA 100 y Bollinger.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketSnapshotSchema = z.object({
  pair: z.string(),
  currentPrice: z.number(),
  trend: z.enum(['UPWARD', 'DOWNWARD', 'SIDEWAYS']),
  adx: z.number().describe('Filtro de fuerza de tendencia (Python Logic)'),
  ema100: z.number().describe('Filtro de dirección macro'),
  rsi: z.number(),
  bb_b: z.number().describe('Posición relativa en Bandas de Bollinger (0-1)'),
});

const AiConsensusMonitorInputSchema = z.object({
  pair: z.string().optional().default('EUR/USD'),
});

const AiConsensusMonitorOutputSchema = z.object({
  overallConsensus: z.enum(['CALL', 'PUT', 'NEUTRAL']),
  consensusPercentage: z.number().min(0).max(100),
  marketContext: z.string(),
  livePrice: z.number(),
  agentRecommendations: z.array(
    z.object({
      agentName: z.string(),
      recommendation: z.enum(['CALL', 'PUT']),
      reasoning: z.string(),
    })
  ),
});

const aiConsensusMonitorPrompt = ai.definePrompt({
  name: 'aiConsensusMonitorPrompt',
  input: {
    schema: z.object({
      pair: z.string(),
      marketData: MarketSnapshotSchema,
    })
  },
  output: {schema: AiConsensusMonitorOutputSchema},
  prompt: `Eres el Núcleo Maestro NeuroTrade V7. Tu estrategia se basa en MERCADO EN RANGO (Python Logic):

DATOS ACTUALES:
- PRECIO: {{{marketData.currentPrice}}}
- RSI: {{{marketData.rsi}}} (Buy < 30, Sell > 70)
- ADX: {{{marketData.adx}}} (Si ADX < 30, el mercado está en rango: OPERA)
- EMA 100: {{{marketData.ema100}}} (Si precio > EMA, tendencia alcista)
- Bollinger %B: {{{marketData.bb_b}}} (0 = Banda inferior, 1 = Banda superior)

REGLAS DE ORO:
1. Solo opera si ADX < 30 (Mercado en rango).
2. Para CALL: Precio debe estar en Banda Inferior (BB %B cerca de 0) Y RSI < 35 Y estar sobre o cerca de la EMA 100.
3. Para PUT: Precio debe estar en Banda Superior (BB %B cerca de 1) Y RSI > 65.

Responde como un comité de 5 agentes expertos en español técnico.`,
});

export const aiConsensusMonitor = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    const now = Date.now();
    const livePrice = 1.14790 + (Math.sin(now / 5000) * 0.002);
    const ema100 = livePrice - 0.0005;
    const adx = 22 + (Math.random() * 15); // Simulación de ADX en rango
    const liveRsi = 40 + (Math.sin(now / 8000) * 35);
    
    const marketData = {
      pair: input.pair,
      currentPrice: parseFloat(livePrice.toFixed(5)),
      trend: liveRsi > 50 ? 'UPWARD' : 'DOWNWARD' as any,
      adx: parseFloat(adx.toFixed(2)),
      ema100: parseFloat(ema100.toFixed(5)),
      rsi: parseFloat(liveRsi.toFixed(2)),
      bb_b: (liveRsi / 100) // Simplificación para la simulación
    };

    try {
      const {output} = await aiConsensusMonitorPrompt({
        pair: input.pair,
        marketData
      });
      return { ...output!, livePrice: marketData.currentPrice };
    } catch (error) {
      return {
        overallConsensus: 'NEUTRAL',
        consensusPercentage: 0,
        marketContext: 'Sincronizando flujo técnico...',
        livePrice: marketData.currentPrice,
        agentRecommendations: []
      };
    }
  }
);
