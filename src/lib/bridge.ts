/**
 * Puente Python híbrido — dos modos de ejecución:
 *
 * 1. RENDER (nube): bridge_server.py desplegado en Render.com — 24/7
 * 2. MI PC (local):  bridge_server.py en el PC del usuario + túnel (localtunnel/ngrok)
 *
 * La preferencia del usuario en Broker Link (localStorage) tiene prioridad
 * sobre NEXT_PUBLIC_BRIDGE_URL para que pueda cambiar de modo sin redeploy.
 */

export const DEFAULT_RENDER_URL = 'https://eurotrade-bridge.onrender.com';
export const DEFAULT_LOCAL_URL = 'http://127.0.0.1:5000';
export const DEFAULT_BRIDGE_TOKEN = 'neurotrade-secret-2024';

/** Timeout en ms para peticiones al puente (Render puede tardar ~30s en despertar) */
const FETCH_TIMEOUT_MS = 75_000;

/** Fetch con timeout. Lanza AbortError si supera el límite. */
export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type BridgeSource = 'cloud' | 'local';

const LS_SOURCE = 'nt_bridge_source';
const LS_RENDER = 'nt_render_url';
const LS_LOCAL = 'nt_tunnel_url'; // clave legacy conservada por compatibilidad

export function getBridgeToken(): string {
  return process.env.NEXT_PUBLIC_BRIDGE_TOKEN || DEFAULT_BRIDGE_TOKEN;
}

export function getBridgeSource(): BridgeSource {
  if (typeof window === 'undefined') return 'cloud';
  const saved = localStorage.getItem(LS_SOURCE);
  if (saved === 'tunnel') return 'local'; // migración desde versión anterior
  return (saved as BridgeSource) || 'cloud';
}

export function setBridgeSource(source: BridgeSource): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_SOURCE, source);
}

export function getRenderUrl(): string {
  if (typeof window !== 'undefined') {
    return (
      process.env.NEXT_PUBLIC_BRIDGE_URL ||
      DEFAULT_RENDER_URL
    ).replace(/\/$/, '');
  }
  return (
    process.env.BRIDGE_URL ||
    process.env.NEXT_PUBLIC_BRIDGE_URL ||
    DEFAULT_RENDER_URL
  ).replace(/\/$/, '');
}

export function getLocalUrl(): string {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem(LS_LOCAL) || DEFAULT_LOCAL_URL).replace(/\/$/, '');
  }
  return DEFAULT_LOCAL_URL;
}

export function setRenderUrl(url: string): void {
  // Ignorado para evitar sobreescribir la ruta en Render
  // if (typeof window === 'undefined') return;
  // localStorage.setItem(LS_RENDER, url.replace(/\/$/, ''));
}

export function setLocalUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_LOCAL, url.replace(/\/$/, ''));
}

/** URL activa según el modo elegido por el usuario. */
export function getBridgeUrl(): string {
  if (typeof window !== 'undefined') {
    return getBridgeSource() === 'cloud' ? getRenderUrl() : getLocalUrl();
  }
  return getRenderUrl();
}

export function getBridgeModeLabel(): string {
  return getBridgeSource() === 'cloud' ? 'RENDER (nube)' : 'MI PC (local)';
}

/** HTTPS (Vercel) no puede llamar a http://127.0.0.1 — usar túnel HTTPS o modo RENDER. */
export function isLocalBridgeBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  if (getBridgeSource() !== 'local') return false;
  const local = getLocalUrl();
  if (!local.startsWith('http://')) return false;
  return window.location.protocol === 'https:';
}

export function getLocalBridgeWarning(): string | null {
  if (!isLocalBridgeBlocked()) return null;
  return 'En Vercel (HTTPS) no se puede usar http://127.0.0.1. Ejecute localtunnel (HTTPS) o cambie a modo RENDER.';
}

export function getBridgeHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Bridge-Token': getBridgeToken(),
    'Bypass-Tunnel-Reminder': 'true',
  };
}

export interface AnalyzeResponse {
  success: boolean;
  balance?: number;
  direction?: 'CALL' | 'PUT' | 'NONE';
  probability?: number;
  rsi?: number;
  pair?: string;
  candles?: Array<{
    from: number;
    open: number;
    max: number;
    min: number;
    close: number;
    volume?: number;
  }>;
  logs?: Array<{ timestamp: number; message: string }>;
  error?: string;
}

export interface TradeResponse {
  success: boolean;
  profit?: number;
  status?: 'win' | 'loss' | 'tie';
  orderId?: string;
  balance?: number;
  error?: string;
}

export async function bridgeHealthCheck(retries = 2): Promise<{
  online: boolean;
  url: string;
  mode: string;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const url = getBridgeUrl();
  const mode = getBridgeModeLabel();
  let lastError = 'Sin conexión';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Esperar antes de reintentar (Render spin-up puede tardar 30-60s)
        await new Promise(r => setTimeout(r, 5000));
      }

      const res = await fetchWithTimeout(
        `${url}/health`,
        {
          method: 'GET',
          headers: {
            'X-Bridge-Token': getBridgeToken(),
            'Bypass-Tunnel-Reminder': 'true',
            'Cache-Control': 'no-cache',
          },
          mode: 'cors',
        },
        35_000, // 35s — cubre el spin-up de Render Free
      );

      if (!res.ok) {
        lastError = `HTTP ${res.status} — ${res.statusText}`;
        continue;
      }

      const data = await res.json();
      if (data?.status === 'ONLINE') {
        return { online: true, url, mode, data };
      }
      lastError = `Respuesta inesperada: ${JSON.stringify(data)}`;
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          lastError = `Timeout (${FETCH_TIMEOUT_MS / 1000}s) — Render está despertando, espere y reintente`;
        } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
          lastError = getBridgeSource() === 'cloud'
            ? 'Failed to fetch — verifique que Render esté desplegado y la URL sea correcta'
            : 'Failed to fetch — verifique que bridge_server.py esté corriendo en su PC';
        } else {
          lastError = e.message;
        }
      }
    }
  }

  return { online: false, url, mode, error: lastError };
}

export async function bridgePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bridgeUrl = getBridgeUrl();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${bridgeUrl}${path}`,
      {
        method: 'POST',
        headers: getBridgeHeaders(),
        body: JSON.stringify(body),
        mode: 'cors',
      },
      40_000,
    );
  } catch (netErr: any) {
    // Distinguir entre error de red/CORS y timeout
    if (netErr?.name === 'AbortError') {
      throw new Error(`TIMEOUT — El puente no respondió en 40s. URL: ${bridgeUrl}${path}`);
    }
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttp = bridgeUrl.startsWith('http://');
    if (isHttps && isHttp) {
      throw new Error(`MIXED-CONTENT BLOQUEADO — Estás en HTTPS pero el puente es HTTP (${bridgeUrl}). Usa modo RENDER o un túnel HTTPS.`);
    }
    throw new Error(`Puente no alcanzable (${bridgeUrl}${path}): ${netErr?.message || 'Failed to fetch'}`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function bridgeAnalyze(payload: {
  email: string;
  password: string;
  pair: string;
  accountType: string;
  minRsi?: number;
  maxRsi?: number;
}): Promise<AnalyzeResponse> {
  return bridgePost<AnalyzeResponse>('/analyze', payload);
}

export async function bridgeConnect(payload: {
  email: string;
  password: string;
  accountType: string;
}): Promise<{ success: boolean; balance?: number; error?: string }> {
  return bridgePost('/connect', payload);
}

export async function bridgeDisconnect(payload: {
  email: string;
  accountType: string;
}): Promise<{ success: boolean }> {
  return bridgePost('/disconnect', payload);
}

export async function bridgeTrade(payload: {
  email: string;
  password: string;
  pair: string;
  direction: 'CALL' | 'PUT';
  amount: number;
  accountType: string;
}): Promise<TradeResponse> {
  return bridgePost<TradeResponse>('/trade', payload);
}

