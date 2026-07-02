import sys
import os
import time
import threading
import concurrent.futures
import logging
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
import ccxt

# Deshabilitar logs molestos de werkzeug
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

# Configuracion CORS global
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Bridge-Token", "Bypass-Tunnel-Reminder", "Cache-Control", "Authorization", "Access-Control-Request-Private-Network"],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=False
)

@app.after_request
def add_pna_headers(response):
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response


# Configuración y Estado del Worker
WORKER_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
binance_instance = None
trade_results = {}
last_activity = time.time()
INACTIVITY_TIMEOUT = 1200

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

from indicators import (
    DEFAULT_MIN_RSI,
    DEFAULT_MAX_RSI,
    calculate_rsi,
    check_news_filter,
    detect_manipulation,
    calculate_sma,
    calculate_ema,
    calculate_bollinger_bands,
    calculate_atr,
    calculate_macd,
    evaluate_strategy_mode,
    analyze_market,
    build_logs
)

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
                {"from": int(c[0]/1000), "open": c[1], "max": c[2], "min": c[3], "close": c[4], "volume": c[5]}
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
