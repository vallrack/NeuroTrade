
import { ai } from './genkit';

type AnalysisResult = {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  reason: string;
  source: string;
};

// 1. Motor Google Gemini (Genkit Nativo)
async function analyzeWithGemini(data: any): Promise<AnalysisResult> {
  try {
    const response = await ai.generate({
      prompt: `Actúa como un analista HFT. Datos actuales: ${JSON.stringify(data)}. Responde SOLO JSON: {signal: "BUY"|"SELL"|"NEUTRAL", confidence: 0-100, reason: "..."}`
    });
    const parsed = JSON.parse(response.text);
    return { ...parsed, source: 'Gemini 2.0' };
  } catch (e) {
    return { signal: 'NEUTRAL', confidence: 0, reason: 'Error en servicio', source: 'Gemini' };
  }
}

// 2. Motor Groq (Llama 3 - Ultra Velocidad)
async function analyzeWithGroq(data: any): Promise<AnalysisResult> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: `Analiza este mercado para scalping: ${JSON.stringify(data)}. Responde JSON puro: {"signal": "...", "confidence": ..., "reason": "..."}` }],
        response_format: { type: "json_object" }
      })
    });
    const json = await res.json();
    return { ...JSON.parse(json.choices[0].message.content), source: 'Groq/Llama3' };
  } catch (e) { return { signal: 'NEUTRAL', confidence: 0, reason: 'Offline', source: 'Groq' }; }
}

// 3. Motor DeepSeek (Análisis Lógico Profundo)
async function analyzeWithDeepSeek(data: any): Promise<AnalysisResult> {
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: `Evaluación de riesgo matemático: ${JSON.stringify(data)}. Responde JSON: {"signal": "...", "confidence": ..., "reason": "..."}` }]
      })
    });
    const json = await res.json();
    return { ...JSON.parse(json.choices[0].message.content), source: 'DeepSeek-V3' };
  } catch (e) { return { signal: 'NEUTRAL', confidence: 0, reason: 'Offline', source: 'DeepSeek' }; }
}

// 4. Motor OpenAI (GPT-4o - Visión General)
async function analyzeWithOpenAI(data: any): Promise<AnalysisResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Decisión final de trading: ${JSON.stringify(data)}. Responde JSON: {"signal": "...", "confidence": ..., "reason": "..."}` }],
        response_format: { type: "json_object" }
      })
    });
    const json = await res.json();
    return { ...JSON.parse(json.choices[0].message.content), source: 'OpenAI' };
  } catch (e) { return { signal: 'NEUTRAL', confidence: 0, reason: 'Offline', source: 'OpenAI' }; }
}

// ── ORQUESTADOR MAESTRO (EL COMITÉ) ──────────────────────────
export async function getCommitteeDecision(marketData: any) {
  const [gemini, groq, deepseek, openai] = await Promise.all([
    analyzeWithGemini(marketData),
    analyzeWithGroq(marketData),
    analyzeWithDeepSeek(marketData),
    analyzeWithOpenAI(marketData)
  ]);

  const results = [gemini, groq, deepseek, openai];
  const validResults = results.filter(r => r.confidence > 20);

  // Votación por mayoría
  const signals = validResults.map(r => r.signal);
  const buyVotes = signals.filter(s => s === 'BUY').length;
  const sellVotes = signals.filter(s => s === 'SELL').length;

  let finalSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (buyVotes > sellVotes && buyVotes >= 2) finalSignal = 'BUY';
  if (sellVotes > buyVotes && sellVotes >= 2) finalSignal = 'SELL';

  return {
    decision: finalSignal,
    consensus: (Math.max(buyVotes, sellVotes) / results.length) * 100,
    details: results
  };
}
