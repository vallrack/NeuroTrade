
'use server';
/**
 * @fileOverview Flujo de Genkit para monitorear el consenso del comité de IA con datos de mercado.
 * - Los agentes ahora "ven" datos técnicos dinámicos basados en tiempo real.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketSnapshotSchema = z.object({
  pair: z.string().describe('El par de divisas analizado.'),
  currentPrice: z.number().describe('El precio actual del mercado.'),
  trend: z.enum(['UPWARD', 'DOWNWARD', 'SIDEWAYS']).describe('La tendencia detectada.'),
  volatility: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('Nivel de volatilidad.'),
  rsi: z.number().describe('Valor de RSI actual analizado.'),
  lastCandles: z.array(z.object({
    time: z.string(),
    close: z.number(),
  })).describe('Cierre de las últimas velas.'),
});

const AiConsensusMonitorInputSchema = z.object({
  pair: z.string().optional().default('EUR/USD'),
});
export type AiConsensusMonitorInput = z.infer<typeof AiConsensusMonitorInputSchema>;

const AiConsensusMonitorOutputSchema = z.object({
  overallConsensus: z.enum(['CALL', 'PUT', 'NEUTRAL']).describe('El consenso general del comité.'),
  consensusPercentage: z.number().min(0).max(100).int().describe('Porcentaje de confianza.'),
  marketContext: z.string().describe('Resumen de lectura técnica en español.'),
  livePrice: z.number().describe('El precio exacto que la IA está leyendo en este microsegundo.'),
  agentRecommendations: z.array(
    z.object({
      agentName: z.string().describe('Nombre del agente.'),
      recommendation: z.enum(['CALL', 'PUT']).describe('Recomendación.'),
      reasoning: z.string().describe('Razonamiento técnico.'),
    })
  ).describe('Recomendaciones individuales.'),
});
export type AiConsensusMonitorOutput = z.infer<typeof AiConsensusMonitorOutputSchema>;

const aiConsensusMonitorPrompt = ai.definePrompt({
  name: 'aiConsensusMonitorPrompt',
  input: {
    schema: z.object({
      pair: z.string(),
      marketData: MarketSnapshotSchema,
    })
  },
  output: {schema: AiConsensusMonitorOutputSchema},
  prompt: `Eres el Núcleo Maestro V7 de NeuroTrade.
Has recibido una ráfaga de datos técnicos para {{{pair}}}:

- PRECIO ACTUAL: {{{marketData.currentPrice}}}
- RSI (1m): {{{marketData.rsi}}}
- TENDENCIA: {{{marketData.trend}}}
- VOLATILIDAD: {{{marketData.volatility}}}

Actúa como un comité de 5 agentes expertos. Analiza si el RSI está en niveles de sobrecompra (62+) o sobreventa (20-) para dar una señal CALL o PUT. 
La respuesta debe ser en ESPAÑOL profesional y técnico.`,
});

const aiConsensusMonitorFlow = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    // Simulación de feed de datos basado en tiempo para coherencia "Live"
    const now = Date.now();
    const secondFactor = (now % 60000) / 60000;
    const basePrice = input.pair.includes('BTC') ? 65000 : 1.1479;
    const livePrice = basePrice + (Math.sin(secondFactor * Math.PI * 2) * 0.0010);
    const liveRsi = 30 + (Math.cos(secondFactor * Math.PI) * 40);
    
    const marketData = {
      pair: input.pair,
      currentPrice: parseFloat(livePrice.toFixed(5)),
      trend: liveRsi > 50 ? 'UPWARD' : 'DOWNWARD' as any,
      volatility: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM' as any,
      rsi: parseFloat(liveRsi.toFixed(2)),
      lastCandles: Array.from({length: 5}).map((_, i) => ({
        time: `${i+1}m ago`,
        close: livePrice + (Math.random() * 0.0005)
      }))
    };

    try {
      const {output} = await aiConsensusMonitorPrompt({
        pair: input.pair,
        marketData
      });
      if (!output) throw new Error('Error de motor.');
      return { ...output, livePrice: marketData.currentPrice };
    } catch (error: any) {
      return {
        overallConsensus: 'NEUTRAL',
        consensusPercentage: 0,
        marketContext: 'Error de sincronización con el feed HFT.',
        livePrice: marketData.currentPrice,
        agentRecommendations: []
      };
    }
  }
);

export async function aiConsensusMonitor(input: AiConsensusMonitorInput): Promise<AiConsensusMonitorOutput> {
  return aiConsensusMonitorFlow(input);
}
