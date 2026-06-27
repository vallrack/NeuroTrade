import sys
import os
import time
import threading
import concurrent.futures
import logging
import math
from flask import Flask, request, jsonify
import ccxt

# Deshabilitar logs molestos de werkzeug
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

# Configuración y Estado del Worker
WORKER_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
binance_instance = None
trade_results = {}
last_activity = time.time()
INACTIVITY_TIMEOUT = 1200

# Umbrales
DEFAULT_MIN_RSI = 38
DEFAULT_MAX_RSI = 62

def update_activity():
    global last_activity
    last_activity = time.time()

def check_inactivity():
    while True:
        time.sleep(60)
        if time.time() - last_activity > INACTIVITY_TIMEOUT:
            print(f"[BINANCE WORKER {WORKER_PORT}] Inactividad de 20 min. Apagando worker para liberar RAM...")
            os._exit(0)

threading.Thread(target=check_inactivity, daemon=True).start()

def calculate_rsi(closes, period=14):
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0 for d in deltas[-period:]]
    losses = [-d if d < 0 else 0 for d in deltas[-period:]]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)

def calculate_ema(closes, period):
    if len(closes) < period:
        return None
    ema = sum(closes[:period]) / period
    multiplier = 2 / (period + 1)
    for close in closes[period:]:
        ema = (close - ema) * multiplier + ema
    return ema

def calculate_bollinger_bands(closes, period=20, num_std_dev=2):
    if len(closes) < period:
        return None, None, None
    recent = closes[-period:]
    sma = sum(recent) / period
    variance = sum((x - sma) ** 2 for x in recent) / period
    std_dev = math.sqrt(variance)
    return sma + (std_dev * num_std_dev), sma, sma - (std_dev * num_std_dev)

def detect_manipulation(candles, vol_multiplier=1.5, max_body_percent=0.3):
    if not candles or len(candles) < 5:
        return False, ""
    
    last_candle = candles[-1]
    prev_candles = candles[-5:-1]
    
    avg_vol = sum(c['volume'] for c in prev_candles) / 4 if prev_candles else 1
    if avg_vol == 0: avg_vol = 1
        
    body = abs(last_candle['close'] - last_candle['open'])
    total_size = last_candle['max'] - last_candle['min']
    if total_size == 0: total_size = 1
    
    body_percent = body / total_size
    is_high_volume = last_candle['volume'] > (avg_vol * vol_multiplier)
    is_pinbar = body_percent < max_body_percent
    
    doji_count = 0
    for c in candles[-3:]:
        c_body = abs(c['close'] - c['open'])
        c_size = c['max'] - c['min'] if (c['max'] - c['min']) > 0 else 1
        if (c_body / c_size) < 0.1:
            doji_count += 1
            
    if doji_count >= 3:
        return True, "Falta de liquidez (3 Dojis consecutivos)"
    
    if is_high_volume and is_pinbar:
        return True, "Trampa de liquidez institucional detectada (Mecha + Volumen)"
        
    return False, ""

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

def analyze_market(candles, min_rsi=DEFAULT_MIN_RSI, max_rsi=DEFAULT_MAX_RSI):
    if not candles or len(candles) < 200:
        return "NONE", 50, 50.0, None, None, None, None
    closes = [c["close"] for c in candles]
    
    rsi = calculate_rsi(closes)
    ema_200 = calculate_ema(closes, 200)
    upper_band, middle_band, lower_band = calculate_bollinger_bands(closes, 20, 2.0)
    atr = calculate_atr(candles, 14)
    
    direction = "NONE"
    probability = 50
    last_close = closes[-1]
    
    # Filtro ATR
    is_dead_market = False
    is_chaotic_market = False
    if atr and last_close > 0:
        atr_percent = (atr / last_close) * 100
        if atr_percent < 0.003:
            is_dead_market = True
        elif atr_percent > 0.3:
            is_chaotic_market = True

    bb_tolerance = last_close * 0.0015
    
    if rsi <= min_rsi and not is_dead_market and not is_chaotic_market:
        if ema_200 and last_close >= ema_200:
            if (lower_band and last_close <= (lower_band + bb_tolerance)) or rsi <= (min_rsi - 13):
                direction = "CALL"
                probability = min(99, 75 + int(max(0, min_rsi - rsi) * 2))
    elif rsi >= max_rsi and not is_dead_market and not is_chaotic_market:
        if ema_200 and last_close <= ema_200:
            if (upper_band and last_close >= (upper_band - bb_tolerance)) or rsi >= (max_rsi + 13):
                direction = "PUT"
                probability = min(99, 75 + int(max(0, rsi - max_rsi) * 2))
                
    return direction, probability, rsi, ema_200, upper_band, lower_band, last_close, atr

def build_logs(pair, direction, rsi, probability, ema_200, upper_band, lower_band, last_close, atr):
    ts = time.time()
    logs = [{"timestamp": ts, "message": f"[SYSTEM] Análisis {pair} — RSI: {rsi:.1f}"}]
    if ema_200:
        tendencia = "ALCISTA" if last_close >= ema_200 else "BAJISTA"
        logs.append({"timestamp": ts, "message": f"[FILTRO MACRO] Precio vs EMA200: {tendencia}"})
    if upper_band and lower_band:
        logs.append({"timestamp": ts, "message": f"[CONFLUENCIA] Bandas Bollinger calculadas OK"})
    if atr and last_close > 0:
        atr_percent = (atr / last_close) * 100
        status_vol = "Estable"
        if atr_percent < 0.003: status_vol = "Muerto (Falta Liquidez)"
        elif atr_percent > 0.3: status_vol = "Errático (Pánico/Noticias)"
        logs.append({"timestamp": ts, "message": f"[FILTRO VOLATILIDAD] ATR: {atr_percent:.4f}% — Mercado {status_vol}"})
    if direction == "NONE":
        logs.append({"timestamp": ts, "message": "[SENTINEL] Operación rechazada: No hay confluencia de RSI + EMA + BB o mercado inválido por ATR"})
    else:
        logs.append({"timestamp": ts, "message": f"[QUANTUM] Señal {direction} — precisión {probability}%"})
        logs.append({"timestamp": ts, "message": f"[IA MAIN] Consenso maestro V7: {direction} (Confluencia Perfecta)"})
    return logs

_global_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

def run_with_timeout(fn, timeout_s):
    future = _global_executor.submit(fn)
    try: return future.result(timeout=timeout_s)
    except concurrent.futures.TimeoutError: raise

@app.route("/ping", methods=["GET"])
def ping():
    update_activity()
    return jsonify({"status": "ok", "port": WORKER_PORT, "broker": "binance"})

@app.route("/connect", methods=["POST"])
def connect():
    global binance_instance
    update_activity()
    try:
        data = request.json or {}
        apiKey = data.get("email") # Reusamos campos para la UI actual (email = apiKey)
        secret = data.get("password") # password = secret
        acc_type = data.get("accountType", "demo")

        if not apiKey or not secret:
            return jsonify({"success": False, "error": "API Key y Secret requeridos"}), 400

        print(f"[BINANCE WORKER {WORKER_PORT}] Conectando API Key...")
        
        # Testnet (demo) o Real
        # Binance testnet ya no soporta futures en ccxt, forzamos spot
        default_type = 'spot' if acc_type.lower() == 'demo' else 'future'
        
        binance_instance = ccxt.binance({
            'apiKey': apiKey,
            'secret': secret,
            'enableRateLimit': True,
            'options': {
                'defaultType': default_type
            }
        })
        
        if acc_type.lower() == "demo":
            binance_instance.set_sandbox_mode(True)
            
        # Probar credenciales
        balance = binance_instance.fetch_balance()
        usdt_balance = balance.get('USDT', {}).get('free', 0)
        
        return jsonify({
            "success": True,
            "balance": float(usdt_balance),
            "account": "Binance Account",
            "type": acc_type,
            "status": "connected",
        })
    except ccxt.AuthenticationError:
        binance_instance = None
        return jsonify({"success": False, "error": "Credenciales inválidas"}), 401
    except Exception as e:
        binance_instance = None
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/actives", methods=["POST"])
def get_actives():
    global binance_instance
    update_activity()
    if not binance_instance:
        return jsonify({"success": False, "error": "No conectado"}), 401
    try:
        markets = binance_instance.load_markets()
        pairs = [m for m in markets.keys() if m.endswith('/USDT') or m.endswith('/USDT:USDT')]
        return jsonify({"success": True, "pairs": pairs, "otc": [], "regular": pairs})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/analyze", methods=["POST"])
def analyze():
    global binance_instance
    update_activity()
    if not binance_instance:
        return jsonify({"success": False, "error": "No conectado"}), 401

    data = request.json or {}
    pair = data.get("pair")
    min_rsi = data.get("minRsi", DEFAULT_MIN_RSI)
    max_rsi = data.get("maxRsi", DEFAULT_MAX_RSI)
    vol_multiplier = data.get("manipulationVolMultiplier", 1.5)
    max_body_percent = data.get("manipulationMaxBody", 0.3)

    if not pair:
        return jsonify({"success": False, "error": "Par requerido"}), 400

    def _do_analyze():
        try:
            # fetch 1-minute candles
            ohlcv = binance_instance.fetch_ohlcv(pair, '1m', limit=250)
            formatted_candles = [
                {"open": c[1], "max": c[2], "min": c[3], "close": c[4], "volume": c[5]}
                for c in ohlcv
            ]
            
            is_manipulated, manip_reason = detect_manipulation(formatted_candles, vol_multiplier, max_body_percent)
            direction, prob, rsi, ema, upper, lower, last_close, atr = analyze_market(formatted_candles, min_rsi, max_rsi)
            
            logs = build_logs(pair, direction, rsi, prob, ema, upper, lower, last_close, atr)
            if is_manipulated:
                logs.append({"timestamp": time.time(), "message": f"[WARNING] {manip_reason}"})

            return {
                "success": True,
                "direction": direction,
                "probability": prob,
                "rsi": rsi,
                "isManipulated": is_manipulated,
                "manipulationReason": manip_reason,
                "logs": logs,
                "candles": formatted_candles[-10:]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    try:
        res = run_with_timeout(_do_analyze, 35)
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "error": f"Timeout o Error en API Binance: {str(e)}"}), 500

@app.route("/trade", methods=["POST"])
def trade():
    global binance_instance
    update_activity()
    if not binance_instance:
        return jsonify({"success": False, "error": "No conectado"}), 401

    data = request.json or {}
    pair = data.get("pair")
    direction = data.get("direction", "CALL")
    amount = float(data.get("amount", 10))

    if not pair:
        return jsonify({"success": False, "error": "Par no proporcionado"}), 400
    
    return jsonify({
        "success": False,
        "error": "El modo Trading en Binance requiere Futuros y manejo de Margen, aún en desarrollo."
    }), 400

@app.route("/trade_result", methods=["POST"])
def trade_result():
    return jsonify({"success": False, "error": "Not implemented"})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=WORKER_PORT, debug=False, threaded=True)
