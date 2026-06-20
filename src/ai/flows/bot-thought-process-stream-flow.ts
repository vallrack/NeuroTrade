'use server';
/**
 * @fileOverview A Genkit flow for retrieving a snapshot of the latest AI-generated log entries from the trading bot.
 * This flow is intended to be called by the client to get an initial set of logs or to refresh them.
 * Real-time streaming for continuous updates to the UI is typically handled by client-side Firebase Realtime Database listeners (onValue or onChildAdded),
 * as indicated by the application's requirements (RF-41).
 *
 * - botThoughtProcessStream - A function that fetches the latest log entries from Firebase Realtime Database.
 * - BotLogEntry - The type for a single log entry, including timestamp and message.
 * - BotThoughtProcessStreamInput - The input type for the botThoughtProcessStream function, allowing specification of the number of logs to retrieve and the RTDB path.
 * - BotThoughtProcessStreamOutput - The return type for the botThoughtProcessStream function, containing an array of log entries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { rtdb } from '@/firebase/admin'; // Assuming Firebase Admin SDK for RTDB is initialized and exported as `rtdb`

const BotLogEntrySchema = z.object({
  id: z.string().describe('Unique ID of the log entry (e.g., Firebase key).'),
  timestamp: z.number().describe('Timestamp of the log entry in milliseconds since epoch.'),
  message: z.string().describe('The AI-generated log message.'),
  agentId: z.string().optional().describe('Optional ID of the AI agent that generated the log.'),
  direction: z.enum(['CALL', 'PUT', 'NONE']).optional().describe('If applicable, the trading direction recommended by the AI.'),
  confidence: z.number().optional().describe('If applicable, the confidence score of the AI recommendation (0-1).'),
});
export type BotLogEntry = z.infer<typeof BotLogEntrySchema>;

const BotThoughtProcessStreamInputSchema = z.object({
  limit: z.number().int().positive().default(50).describe('The maximum number of log entries to retrieve.'),
  path: z.string().default('logs/bot_reasoning').describe('The Firebase Realtime Database path to the bot logs.'),
});
export type BotThoughtProcessStreamInput = z.infer<typeof BotThoughtProcessStreamInputSchema>;

const BotThoughtProcessStreamOutputSchema = z.object({
  logs: z.array(BotLogEntrySchema).describe('An array of the latest AI-generated log entries, ordered by timestamp descending.'),
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
    const { limit, path } = input;
    const ref = rtdb.ref(path);

    // Fetch the latest 'limit' entries, ordered by timestamp.
    // RTDB's limitToLast retrieves items in ascending order by key/child value.
    const snapshot = await ref.orderByChild('timestamp').limitToLast(limit).get();

    const logs: BotLogEntry[] = [];
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data) {
        logs.push({
          id: childSnapshot.key!,
          timestamp: data.timestamp,
          message: data.message,
          agentId: data.agentId,
          direction: data.direction,
          confidence: data.confidence,
        });
      }
    });

    // Reverse the array to have the latest logs first (descending order).
    logs.reverse();

    return { logs };
  }
);
