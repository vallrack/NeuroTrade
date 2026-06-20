
'use server';
/**
 * @fileOverview Flujo de Genkit para monitorear el consenso del comité de IA.
 * Utiliza el modelo estable Gemini 1.5 Flash.
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
      agentName: z.string().describe('El nombre del agente de IA.'),
      recommendation: z.enum(['CALL', 'PUT']).describe('La recomendación de trading del agente.'),
      reasoning: z.string().describe('Una breve explicación del razonamiento del agente en español.'),
    })
  ).describe('Lista de recomendaciones individuales.'),
});
export type AiConsensusMonitorOutput = z.infer<typeof AiConsensusMonitorOutputSchema>;

const aiConsensusMonitorPrompt = ai.definePrompt({
  name: 'aiConsensusMonitorPrompt',
  input: {schema: AiConsensusMonitorInputSchema},
  output: {schema: AiConsensusMonitorOutputSchema},
  prompt: `Eres el orquestador de un Ejército de IA para trading. 
Simula una evaluación de mercado en tiempo real.
Genera 5 agentes con nombres técnicos (ej. Gemini Sentinel, GPT Sentinel, DeepSeek Analyzer).
Cada agente debe dar CALL o PUT y un razonamiento breve en ESPAÑOL.
Calcula el consenso general y el porcentaje de confianza.`,
});

const aiConsensusMonitorFlow = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    // Forzamos el uso del modelo estable
    const {output} = await aiConsensusMonitorPrompt(input);
    if (!output) {
      throw new Error('Error al obtener el consenso de IA.');
    }
    return output;
  }
);

export async function aiConsensusMonitor(input: AiConsensusMonitorInput): Promise<AiConsensusMonitorOutput> {
  return aiConsensusMonitorFlow(input);
}
