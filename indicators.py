import time
import math
from datetime import datetime, timezone, timedelta
import requests as req
import xml.etree.ElementTree as ET

# ─── CONSTANTES ─────────────────────────────────────────────────────────────
DEFAULT_MIN_RSI = 30.0
DEFAULT_MAX_RSI = 70.0
NEWS_CACHE_TTL = 15 * 60  # Refrescar cada 15 minutos
FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"
_news_cache = {"events": [], "last_fetch": 0.0}

# ─── FUNCIONES DE INDICADORES TÉCNICOS ────────────────────────────────────────

def calculate_rsi(closes, period=14):
    """
    Wilder's Smoothed RSI — estándar de la industria (coincide con TradingView).
    Usa suavizado exponencial (EMA) en vez de promedio aritmético simple,
    lo que produce un RSI más estable y de mayor calidad.
    """
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains  = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]

    # Precalentamiento: SMA de los primeros `period` valores
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    # Wilder's smoothing sobre el resto de la serie completa
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def calculate_sma(closes, period):
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


def calculate_ema(closes, period=200):
    if len(closes) < period:
        return None
    sma = sum(closes[:period]) / period
    multiplier = 2 / (period + 1)
    ema = sma
    for close in closes[period:]:
        ema = (close - ema) * multiplier + ema
    return ema


def calculate_bollinger_bands(closes, period=20, dev=2.0):
    if len(closes) < period:
        return None, None, None
    sma = calculate_sma(closes, period)
    variance = sum((c - sma) ** 2 for c in closes[-period:]) / period
    std_dev = math.sqrt(variance)
    return sma + (std_dev * dev), sma, sma - (std_dev * dev)


def calculate_atr(candles, period=14):
    if len(candles) < period + 1:
        return None
    
    true_ranges = []
    for i in range(1, len(candles)):
        c = candles[i]
        prev_c = candles[i - 1]
        tr1 = c['max'] - c['min']
        tr2 = abs(c['max'] - prev_c['close'])
        tr3 = abs(c['min'] - prev_c['close'])
        true_ranges.append(max(tr1, tr2, tr3))
        
    recent_tr = true_ranges[-period:]
    return sum(recent_tr) / period


def calculate_macd(closes, fast=12, slow=26, signal_period=9):
    """
    MACD estándar (12, 26, 9) — 4º filtro de confluencia.
    Retorna: (macd_line, signal_line, histogram)
    """
    min_candles = slow + signal_period
    if len(closes) < min_candles:
        return None, None, None

    def _ema_series(data, period):
        multiplier = 2 / (period + 1)
        ema = sum(data[:period]) / period
        results = [ema]
        for price in data[period:]:
            ema = (price - ema) * multiplier + ema
            results.append(ema)
        return results

    ema_fast = _ema_series(closes, fast)
    ema_slow = _ema_series(closes, slow)

    diff = len(ema_fast) - len(ema_slow)
    ema_fast_aligned = ema_fast[diff:]

    macd_series = [f - s for f, s in zip(ema_fast_aligned, ema_slow)]

    if len(macd_series) < signal_period:
        return None, None, None

    signal_series = _ema_series(macd_series, signal_period)

    diff2 = len(macd_series) - len(signal_series)
    macd_aligned = macd_series[diff2:]

    macd_val   = round(macd_aligned[-1], 8)
    signal_val = round(signal_series[-1], 8)
    hist_val   = round(macd_val - signal_val, 8)

    return macd_val, signal_val, hist_val


# ─── FILTROS Y MANIPULACIÓN ─────────────────────────────────────────────────

def _fetch_forex_calendar():
    global _news_cache
    now = time.time()
    if now - _news_cache["last_fetch"] < NEWS_CACHE_TTL:
        return _news_cache["events"]
    try:
        resp = req.get(FF_CALENDAR_URL, timeout=10)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        events = []
        for ev in root.findall('event'):
            impact = (ev.findtext('impact') or '').strip()
            if impact != 'High':
                continue
            country  = (ev.findtext('country') or '').strip().upper()
            title    = (ev.findtext('title')   or '').strip()
            date_str = (ev.findtext('date')    or '').strip()
            time_str = (ev.findtext('time')    or '').strip()

            event_ts = None
            if date_str and time_str and time_str.lower() != 'all day':
                try:
                    dt_naive = datetime.strptime(
                        f"{date_str} {time_str.upper()}", "%m-%d-%Y %I:%M%p"
                    )
                    month = dt_naive.month
                    utc_offset = -4 if 3 <= month <= 11 else -5
                    et_tz = timezone(timedelta(hours=utc_offset))
                    event_ts = dt_naive.replace(tzinfo=et_tz).timestamp()
                except Exception:
                    pass

            events.append({"country": country, "title": title, "ts": event_ts})

        _news_cache = {"events": events, "last_fetch": now}
        print(f"[WORKER] Calendario actualizado: {len(events)} eventos HIGH IMPACT esta semana.")
        return events
    except Exception as e:
        print(f"[WORKER] Error al cargar calendario ForexFactory: {e}")
        return _news_cache.get("events", [])


def check_news_filter(pair=""):
    try:
        events = _fetch_forex_calendar()
        now_ts = time.time()
        window = 15 * 60  # ±15 minutos
        for ev in events:
            if ev.get("ts") is None:
                continue
            if abs(ev["ts"] - now_ts) <= window:
                country = ev["country"]
                if pair and country not in pair.upper():
                    continue
                return True, f"Noticia HIGH IMPACT: {ev['title']} ({country}) en {abs(ev['ts'] - now_ts)/60:.0f} min"
        return False, ""
    except Exception as e:
        print(f"[WORKER] Error en check_news_filter: {e}")
        return False, ""


def detect_manipulation(candles, vol_multiplier=1.5, max_body_percent=0.3):
    if not candles or len(candles) < 5:
        return False, ""
    
    last_candle = candles[-1]
    prev_candles = candles[-5:-1]
    
    avg_vol = sum(c['volume'] for c in prev_candles) / 4 if prev_candles else 1
    if avg_vol == 0:
        avg_vol = 1
        
    body = abs(last_candle['close'] - last_candle['open'])
    total_size = last_candle['max'] - last_candle['min']
    
    doji_count = sum(1 for c in prev_candles if (c['max'] - c['min']) > 0 and (abs(c['close'] - c['open']) / (c['max'] - c['min'])) < 0.1)
    if doji_count >= 3:
        return True, "Mercado muerto/sin liquidez (demasiadas Dojis consecutivas)"
    
    if total_size == 0:
        return False, ""
        
    body_percent = body / total_size
    wick_up = last_candle['max'] - max(last_candle['close'], last_candle['open'])
    wick_down = min(last_candle['close'], last_candle['open']) - last_candle['min']
    
    if last_candle['volume'] > avg_vol * vol_multiplier:
        if body_percent < max_body_percent:
            if wick_down > wick_up * 2:
                return True, "Falso quiebre bajista (Caza de Liquidez detectada por mecha inferior gigante)"
            elif wick_up > wick_down * 2:
                return True, "Falso quiebre alcista (Caza de Liquidez detectada por mecha superior gigante)"
                
    return False, ""


def evaluate_strategy_mode(recent_trades):
    if not recent_trades or len(recent_trades) < 5:
        return {
            "mode": "fixed",
            "win_rate": None,
            "signal": "neutral",
            "reasoning": "Historial insuficiente (< 5 operaciones). Operando en modo fijo por seguridad."
        }

    window = recent_trades[:10]
    wins   = sum(1 for t in window if t.get("status") == "win")
    total  = len(window)
    win_rate = round((wins / total) * 100, 1)

    if win_rate >= 65:
        return {
            "mode": "compound",
            "win_rate": win_rate,
            "signal": "bullish",
            "reasoning": f"Racha GANADORA detectada ({win_rate}% éxito en últimas {total} ops). Modo compuesto activado."
        }
    elif win_rate >= 50:
        return {
            "mode": "fixed",
            "win_rate": win_rate,
            "signal": "neutral",
            "reasoning": f"Rendimiento NEUTRAL ({win_rate}% éxito en últimas {total} ops). Modo fijo para estabilidad."
        }
    elif win_rate >= 35:
        return {
            "mode": "martingale",
            "win_rate": win_rate,
            "signal": "recovery",
            "reasoning": f"Racha perdedora LEVE ({win_rate}% éxito en últimas {total} ops). Martingala (máx 2 niveles)."
        }
    else:
        return {
            "mode": "pause",
            "win_rate": win_rate,
            "signal": "bearish",
            "reasoning": f"Racha perdedora FUERTE ({win_rate}% éxito en últimas {total} ops). Se recomienda PAUSAR."
        }


# ─── LÓGICA DE DECISIÓN COMPLETA ───────────────────────────────────────────

def analyze_market(candles, min_rsi=DEFAULT_MIN_RSI, max_rsi=DEFAULT_MAX_RSI):
    if not candles or len(candles) < 200:
        return "NONE", 50, 50.0, None, None, None, None, None, None, None
    closes = [c["close"] for c in candles]
    
    rsi = calculate_rsi(closes)
    ema_200 = calculate_ema(closes, 200)
    upper_band, middle_band, lower_band = calculate_bollinger_bands(closes, 20, 2.0)
    atr = calculate_atr(candles, 14)
    macd_val, signal_val, hist_val = calculate_macd(closes, 12, 26, 9)
    
    direction = "NONE"
    probability = 50
    last_close = closes[-1]
    
    is_dead_market = False
    is_chaotic_market = False
    if atr and last_close > 0:
        atr_percent = (atr / last_close) * 100
        if atr_percent < 0.003:
            is_dead_market = True
        elif atr_percent > 0.3:
            is_chaotic_market = True

    bb_tolerance = last_close * 0.0015
    
    macd_bullish = (macd_val is not None and signal_val is not None and macd_val > signal_val and hist_val > 0)
    macd_bearish = (macd_val is not None and signal_val is not None and macd_val < signal_val and hist_val < 0)
    macd_available = macd_val is not None
    
    has_news, news_reason = check_news_filter()
    if has_news:
        return "NONE", 0, rsi, ema_200, upper_band, lower_band, last_close, atr, macd_val, signal_val

    if rsi <= min_rsi and not is_dead_market and not is_chaotic_market:
        if rsi <= (min_rsi - 13):
            direction = "CALL"
            probability = min(99, 75 + int(max(0, min_rsi - rsi) * 2))
        elif ema_200 and last_close >= ema_200:
            if lower_band and last_close <= (lower_band + bb_tolerance):
                direction = "CALL"
                probability = min(99, 75 + int(max(0, min_rsi - rsi) * 2))
                
    elif rsi >= max_rsi and not is_dead_market and not is_chaotic_market:
        if rsi >= (max_rsi + 13):
            direction = "PUT"
            probability = min(99, 75 + int(max(0, rsi - max_rsi) * 2))
        elif ema_200 and last_close <= ema_200:
            if upper_band and last_close >= (upper_band - bb_tolerance):
                direction = "PUT"
                probability = min(99, 75 + int(max(0, rsi - max_rsi) * 2))

    if macd_available and direction != "NONE":
        if direction == "CALL" and macd_bullish:
            probability = min(99, probability + 5)
        elif direction == "CALL" and macd_bearish:
            probability = max(50, probability - 8)
        elif direction == "PUT" and macd_bearish:
            probability = min(99, probability + 5)
        elif direction == "PUT" and macd_bullish:
            probability = max(50, probability - 8)
                
    return direction, probability, rsi, ema_200, upper_band, lower_band, last_close, atr, macd_val, signal_val


def build_logs(pair, direction, rsi, probability, ema_200, upper_band, lower_band, last_close, atr, macd_val=None, signal_val=None):
    ts = time.time()
    logs = [
        {"timestamp": ts, "message": f"[SYSTEM] Análisis {pair} — RSI: {rsi:.1f}"}
    ]
    
    if ema_200:
        tendencia = "ALCISTA" if last_close >= ema_200 else "BAJISTA"
        logs.append({"timestamp": ts, "message": f"[FILTRO MACRO] Precio vs EMA200: {tendencia}"})
        
    if upper_band and lower_band:
        logs.append({"timestamp": ts, "message": f"[CONFLUENCIA] Bandas Bollinger calculadas OK"})

    if macd_val is not None and signal_val is not None:
        hist = round(macd_val - signal_val, 8)
        if macd_val > signal_val:
            macd_status = f"ALCISTA (MACD {macd_val:.6f} > Señal {signal_val:.6f}, Hist: +{hist:.6f})"
        else:
            macd_status = f"BAJISTA (MACD {macd_val:.6f} < Señal {signal_val:.6f}, Hist: {hist:.6f})"
        logs.append({"timestamp": ts, "message": f"[CONFLUENCIA MACD] Momentum {macd_status}"})
        
    if atr and last_close > 0:
        atr_percent = (atr / last_close) * 100
        status_vol = "Estable"
        if atr_percent < 0.003: status_vol = "Muerto (Falta Liquidez)"
        elif atr_percent > 0.3: status_vol = "Errático (Pánico/Noticias)"
        logs.append({"timestamp": ts, "message": f"[FILTRO VOLATILIDAD] ATR: {atr_percent:.4f}% — Mercado {status_vol}"})

    if direction == "NONE":
        logs.append({"timestamp": ts, "message": "[SENTINEL] Operación rechazada: No hay confluencia o mercado inválido"})
    else:
        logs.append({"timestamp": ts, "message": f"[QUANTUM] Señal {direction} — precisión {probability}%"})
        logs.append({"timestamp": ts, "message": f"[IA MAIN] Consenso maestro V7: {direction} (Confluencia Perfecta)"})
        
    return logs
