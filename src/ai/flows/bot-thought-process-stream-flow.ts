
'use server';
/**
 * @fileOverview A Genkit flow for retrieving simulated AI-generated log entries from the trading bot.
 * We avoid direct RTDB access from the server to prevent credential issues with Admin SDK.
 * Real-time data is handled by client-side components.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BotLogEntrySchema = z.object({
  id: z.string().describe('Unique ID of the log entry.'),
  timestamp: z.number().describe('Timestamp of the log entry in milliseconds since epoch.'),
  message: z.string().describe('The AI-generated log message.'),
  agentId: z.string().optional().describe('Optional ID of the AI agent.'),
  direction: z.enum(['CALL', 'PUT', 'NONE']).optional().describe('Trading direction.'),
  confidence: z.number().optional().describe('Confidence score (0-1).'),
});
export type BotLogEntry = z.infer<typeof BotLogEntrySchema>;

const BotThoughtProcessStreamInputSchema = z.object({
  limit: z.number().int().positive().default(50),
});
export type BotThoughtProcessStreamInput = z.infer<typeof BotThoughtProcessStreamInputSchema>;

const BotThoughtProcessStreamOutputSchema = z.object({
  logs: z.array(BotLogEntrySchema),
});
export type BotThoughtProcessStreamOutput = z.infer<typeof BotThoughtProcessStreamOutputSchema>;

export async function botThoughtProcessStream(input: BotThoughtProcessStreamInput): Promise<BotThoughtProcessStreamOutput> {
  return botThoughtProcessStreamFlow(input);
}

const botThoughtProcessStreamFlow = ai.defineFlow(
  {
    name: 'botThoughtProcessStreamFlow',
    inputSchema: BotThoughtProcessStreamInputSchema,
    outputSchema: BotThoughtProcessStreamOutputSchema,
  },
  async (input) => {
    // Return simulated logs to avoid reliance on failing Admin SDK
    const logs: BotLogEntry[] = [
      {
        id: '1',
        timestamp: Date.now(),
        message: 'Sincronización de flujo de datos completada. Iniciando análisis cuántico.',
        agentId: 'Gemini Prime',
        direction: 'NONE',
        confidence: 0.95
      },
      {
        id: '2',
        timestamp: Date.now() - 5000,
        message: 'Detectada volatilidad en clúster EUR/USD. Ajustando stop-loss.',
        agentId: 'GPT-4 Sentinel',
        direction: 'PUT',
        confidence: 0.82
      }
    ];

    return { logs };
  }
);
