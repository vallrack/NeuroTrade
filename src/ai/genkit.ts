
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ── Motor IA Principal ─────────────────────────────────────────────
// Usa Gemini 2.0 Flash como modelo principal (velocidad + costo óptimo).
// Las API keys del resto del ejército (Groq, DeepSeek, OpenAI, Qwen, XAI)
// están disponibles en process.env para llamadas directas en server actions.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

// ── Modelos disponibles por velocidad / especialidad ──────────────
// Úsalos importando `ai` y cambiando el model en la llamada:
// ai.generate({ model: 'googleai/gemini-1.5-pro', ... })
//
// APIs externas (fuera de Genkit, usar fetch directo):
// GROQ     → https://api.groq.com           (Llama 3 / Mixtral — ultra rápido)
// DeepSeek → https://api.deepseek.com       (análisis de código / razonamiento)
// OpenAI   → https://api.openai.com         (GPT-4o — máxima capacidad)
// Qwen     → https://dashscope.aliyuncs.com (alternativa Asia-Pacífico)
// xAI/Grok → https://api.x.ai              (datos en tiempo real de X)
// Genspark → https://api.genspark.ai        (noticias financieras en tiempo real)
