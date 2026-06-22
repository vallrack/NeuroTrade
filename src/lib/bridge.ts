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
      localStorage.getItem(LS_RENDER) ||
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
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_RENDER, url.replace(/\/$/, ''));
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

export async function bridgeHealthCheck(): Promise<{
  online: boolean;
  url: string;
  mode: string;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const url = getBridgeUrl();
  const mode = getBridgeModeLabel();
  try {
    const res = await fetch(`${url}/health`, {
      headers: { 'X-Bridge-Token': getBridgeToken() },
    });
    if (!res.ok) return { online: false, url, mode, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { online: data?.status === 'ONLINE', url, mode, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sin conexión';
    return { online: false, url, mode, error: message };
  }
}

export async function bridgePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${getBridgeUrl()}${path}`, {
    method: 'POST',
    headers: getBridgeHeaders(),
    body: JSON.stringify(body),
  });
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
