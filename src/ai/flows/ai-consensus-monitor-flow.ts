'use server';
/**
 * @fileOverview This file defines a Genkit flow for monitoring the consensus of an AI trading committee.
 * It provides the overall consensus (CALL/PUT/NEUTRAL), the percentage of agents agreeing,
 * and individual recommendations with reasoning from each AI agent.
 *
 * - aiConsensusMonitor - A function that fetches the AI committee's consensus.
 * - AiConsensusMonitorInput - The input type for the aiConsensusMonitor function.
 * - AiConsensusMonitorOutput - The return type for the aiConsensusMonitor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema: No specific input required for this flow as it simulates the consensus.
const AiConsensusMonitorInputSchema = z.object({});
export type AiConsensusMonitorInput = z.infer<typeof AiConsensusMonitorInputSchema>;

// Output Schema: Defines the structure of the AI committee's consensus and individual recommendations.
const AiConsensusMonitorOutputSchema = z.object({
  overallConsensus: z.enum(['CALL', 'PUT', 'NEUTRAL']).describe('The overall consensus of the AI committee (CALL, PUT, or NEUTRAL).'),
  consensusPercentage: z.number().min(0).max(100).int().describe('The percentage of AI agents agreeing with the overall consensus.').int(),
  agentRecommendations: z.array(
    z.object({
      agentName: z.string().describe('The name of the individual AI agent (e.g., "Agent Alpha", "Market Analyst Bot").'),
      recommendation: z.enum(['CALL', 'PUT']).describe('The trading recommendation of the agent (CALL or PUT).'),
      reasoning: z.string().describe('A brief explanation of the agent\'s reasoning for the recommendation, simulating a real-time market analysis.'),
    })
  ).describe('A list of individual AI agent recommendations, each with its name, recommendation, and reasoning.'),
});
export type AiConsensusMonitorOutput = z.infer<typeof AiConsensusMonitorOutputSchema>;

// Define the prompt for the AI committee.
const aiConsensusMonitorPrompt = ai.definePrompt({
  name: 'aiConsensusMonitorPrompt',
  input: {schema: AiConsensusMonitorInputSchema},
  output: {schema: AiConsensusMonitorOutputSchema},
  prompt: `You are a committee of highly intelligent AI trading agents. Your task is to simulate a real-time market assessment for a hypothetical financial instrument (e.g., "USD/JPY" or "AAPL Stock").

Each of you, acting as a distinct agent, must provide a trading recommendation ('CALL' for buy, 'PUT' for sell) and a brief, unique reasoning based on simulated market conditions. Generate recommendations for 5 to 7 distinct AI agents.

After all agents have provided their input, calculate and state the overall consensus of the committee (either 'CALL', 'PUT', or 'NEUTRAL' if there's no clear majority) and the percentage of agents supporting that overall consensus.

Ensure the output is a JSON object strictly following this structure:
{{jsonSchema output.schema}}

Example for agentRecommendations (ensure names and reasonings are varied):
- Agent Alpha: CALL - "Momentum indicators suggest a bullish trend on the 15-minute chart."
- Agent Beta: PUT - "Bearish divergence spotted on the hourly RSI, indicating potential reversal."
- Agent Gamma: CALL - "Volume profile analysis shows strong support levels being tested, anticipating a bounce."
- Agent Delta: PUT - "Fundamental news sentiment remains negative, likely driving prices lower."
`,
});

// Define the Genkit flow.
const aiConsensusMonitorFlow = ai.defineFlow(
  {
    name: 'aiConsensusMonitorFlow',
    inputSchema: AiConsensusMonitorInputSchema,
    outputSchema: AiConsensusMonitorOutputSchema,
  },
  async input => {
    // Call the prompt to get the AI committee's consensus.
    const {output} = await aiConsensusMonitorPrompt(input);
    if (!output) {
      throw new Error('Failed to get consensus from AI committee.');
    }
    return output;
  }
);

// Exported wrapper function for easier access from Next.js.
export async function aiConsensusMonitor(input: AiConsensusMonitorInput): Promise<AiConsensusMonitorOutput> {
  return aiConsensusMonitorFlow(input);
}
