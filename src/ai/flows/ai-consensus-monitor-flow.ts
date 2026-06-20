
'use server';
/**
 * @fileOverview Flujo de Genkit para monitorear el consenso del comité de IA con datos de mercado.
 * - Los agentes ahora "ven" datos técnicos antes de decidir.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketSnapshotSchema = z.object({
  pair: z.string().describe('El par de divisas analizado.'),
  currentPrice: z.number().describe('El precio actual del mercado.'),
  trend: z.enum(['UPWARD', 'DOWNWARD', 'SIDEWAYS']).describe('La tendencia detectada en los últimos 5 minutos.'),
  volatility: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('Nivel de volatilidad actual.'),
  lastCandles: z.array(z.object({
    time: z.string(),
    close: z.number(),
  })).describe('Cierre de las últimas 5 velas de 1 minuto.'),
});

const AiConsensusMonitorInputSchema = z.object({
  pair: z.string().optional().default('EUR/USD'),
});
export type AiConsensusMonitorInput = z.infer<typeof AiConsensusMonitorInputSchema>;

const AiConsensusMonitorOutputSchema = z.object({
  overallConsensus: z.enum(['CALL', 'PUT', 'NEUTRAL']).describe('El consenso general del comité de IA.'),
  consensusPercentage: z.number().min(0).max(100).int().describe('El porcentaje de confianza.'),
  marketContext: z.string().describe('Breve resumen de lo que la IA "ve" en el mercado en español.'),
  agentRecommendations: z.array(
    z.object({
      agentName: z.string().describe('El nombre del agente de IA.'),
      recommendation: z.enum(['CALL', 'PUT']).describe('Recomendación.'),
      reasoning: z.string().describe('Razonamiento basado en los datos técnicos recibidos.'),
    })
  ).describe('Lista de recomendaciones individuales.'),
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
  prompt: `Eres el orquestador de un Ejército de IA para trading de alta frecuencia.
Has recibido los siguientes datos técnicos del mercado para el par {{{pair}}}:

- Precio Actual: {{{marketData.currentPrice}}}
- Tendencia: {{{marketData.trend}}}
- Volatilidad: {{{marketData.volatility}}}
- Historial de Velas (Cierres): 
{{#each marketData.lastCandles}}
  - {{{this.time}}}: {{{this.close}}}
{{/each}}

Tu tarea es simular una sesión de deliberación con 5 agentes expertos.
Cada agente debe analizar estos datos específicos para dar un CALL o PUT.
No inventes datos, básate en la tendencia y los cierres de las velas proporcionadas.
El resultado debe ser en ESPAÑOL profesional.`,
});

const aiConsensusMonitorFlow = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    // Simulamos la obtención de datos reales del mercado (Mock de Observador)
    const basePrice = input.pair.includes('BTC') ? 65000 : 1.0850;
    const volatilityOffset = Math.random() * 0.0010;
    
    const marketData = {
      pair: input.pair,
      currentPrice: basePrice + volatilityOffset,
      trend: Math.random() > 0.5 ? 'UPWARD' : 'DOWNWARD',
      volatility: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM',
      lastCandles: Array.from({length: 5}).map((_, i) => ({
        time: `${i+1}m ago`,
        close: basePrice + (Math.random() * 0.0020)
      }))
    };

    try {
      const {output} = await aiConsensusMonitorPrompt({
        pair: input.pair,
        marketData
      });
      if (!output) throw new Error('Sin respuesta del motor de IA.');
      return output;
    } catch (error: any) {
      console.error('Error en el flujo de IA:', error.message);
      return {
        overallConsensus: 'NEUTRAL',
        consensusPercentage: 0,
        marketContext: 'Error al sincronizar con el feed de datos en vivo.',
        agentRecommendations: [
          { agentName: 'Sistema de Emergencia', recommendation: 'CALL', reasoning: 'Sincronizando flujos de datos primarios...' }
        ]
      };
    }
  }
);

export async function aiConsensusMonitor(input: AiConsensusMonitorInput): Promise<AiConsensusMonitorOutput> {
  return aiConsensusMonitorFlow(input);
}
