
'use server';
/**
 * @fileOverview Flujo de Genkit para monitorear el consenso del comité de IA (Ejército de Inteligencia).
 * Proporciona el consenso general (COMPRA/VENTA/NEUTRAL), el porcentaje de acuerdo,
 * y recomendaciones individuales con razonamiento técnico en español.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiConsensusMonitorInputSchema = z.object({});
export type AiConsensusMonitorInput = z.infer<typeof AiConsensusMonitorInputSchema>;

const AiConsensusMonitorOutputSchema = z.object({
  overallConsensus: z.enum(['CALL', 'PUT', 'NEUTRAL']).describe('El consenso general del comité de IA (CALL para compra, PUT para venta, o NEUTRAL).'),
  consensusPercentage: z.number().min(0).max(100).int().describe('El porcentaje de agentes de IA que están de acuerdo con el consenso general.'),
  agentRecommendations: z.array(
    z.object({
      agentName: z.string().describe('El nombre del agente de IA (ej. "GPT-4 Strategy", "Gemini Analyst", "DeepSeek Quantum").'),
      recommendation: z.enum(['CALL', 'PUT']).describe('La recomendación de trading del agente.'),
      reasoning: z.string().describe('Una breve explicación del razonamiento del agente en español.'),
    })
  ).describe('Lista de recomendaciones individuales de los agentes del Ejército de IA.'),
});
export type AiConsensusMonitorOutput = z.infer<typeof AiConsensusMonitorOutputSchema>;

const aiConsensusMonitorPrompt = ai.definePrompt({
  name: 'aiConsensusMonitorPrompt',
  input: {schema: AiConsensusMonitorInputSchema},
  output: {schema: AiConsensusMonitorOutputSchema},
  prompt: `Eres el orquestador de un Ejército de Inteligencia Artificial para trading de alta precisión. Tu tarea es simular una evaluación de mercado en tiempo real para activos financieros (como EUR/USD o Bitcoin).

Debes actuar como un comité compuesto por identidades de los modelos líderes: Gemini 1.5, GPT-4o, DeepSeek-V3, Groq-Llama3, Claude 3.5 y xAI-Grok.

Cada agente debe proporcionar:
1. Una recomendación ('CALL' para compra, 'PUT' para venta).
2. Un razonamiento técnico único y sofisticado en ESPAÑOL (mencionando indicadores como RSI, Bandas de Bollinger, soportes, resistencias o sentimiento de mercado).

Calcula el consenso general basado en la mayoría. Si no hay mayoría clara, usa 'NEUTRAL'. Determina el porcentaje de confianza.

Toda la respuesta debe ser en ESPAÑOL.

Ejemplos de nombres de agentes:
- "Comandante Gemini": Experto en análisis de sentimiento global.
- "GPT-4 Sentinel": Especialista en patrones de velas y acción del precio.
- "DeepSeek Quantum": Algoritmo de alta frecuencia y correlaciones.
- "Grok Strategist": Analista de tendencias en redes sociales y noticias.
- "Claude Vision": Analista de estructuras de mercado a largo plazo.
`,
});

const aiConsensusMonitorFlow = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    const {output} = await aiConsensusMonitorPrompt(input);
    if (!output) {
      throw new Error('Error al obtener el consenso del Ejército de IA.');
    }
    return output;
  }
);

export async function aiConsensusMonitor(input: AiConsensusMonitorInput): Promise<AiConsensusMonitorOutput> {
  return aiConsensusMonitorFlow(input);
}
