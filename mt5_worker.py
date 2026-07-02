import os
import sys
import time
import json
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import random

# Import shared indicators
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

if len(sys.argv) > 1:
    WORKER_PORT = int(sys.argv[1])
else:
    WORKER_PORT = 5002

app = Flask(__name__)
CORS(app)

last_activity = time.time()
INACTIVITY_TIMEOUT = 3600  # 1 hora
session_active = False

def update_activity():
    global last_activity
    last_activity = time.time()

def check_inactivity():
    while True:
        time.sleep(60)
        if time.time() - last_activity > INACTIVITY_TIMEOUT:
            print(f"[MT5 WORKER {WORKER_PORT}] Inactividad de 1 hora. Apagando worker...")
            os._exit(0)

threading.Thread(target=check_inactivity, daemon=True).start()

# ─── ENDPOINTS ──────────────────────────────────────────────────────────────

@app.route("/connect", methods=["POST"])
def connect():
    update_activity()
    data = request.json or {}
    # mt5 usually uses login (account id), password, and server
    login = data.get("apiKey")  # UI might pass account id as apiKey
    password = data.get("apiSecret") # UI might pass password as apiSecret
    server = data.get("server", "MetaQuotes-Demo")
    
    global session_active
    
    if not login or not password:
        return jsonify({"status": "error", "message": "Faltan credenciales MT5 (Account ID y Password)"}), 400

    try:
        # TODO: Initialize MT5 client here using MetaTrader5 library
        # import MetaTrader5 as mt5
        # if not mt5.initialize(): ...
        # if not mt5.login(login=int(login), password=password, server=server): ...
        
        session_active = True
        return jsonify({"status": "success", "message": f"Conectado a MT5 (Servidor: {server}) exitosamente"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error conectando a MT5: {str(e)}"}), 500

@app.route("/disconnect", methods=["POST"])
def disconnect():
    update_activity()
    global session_active
    session_active = False
    return jsonify({"status": "success", "message": "Desconectado de MT5"})

@app.route("/balance", methods=["GET"])
def balance():
    update_activity()
    global session_active
    if not session_active:
        return jsonify({"status": "error", "message": "No conectado"}), 401
        
    # Return simulated balance for scaffold validation
    simulated_balance = random.uniform(5000, 10000)
    return jsonify({"status": "success", "balance": round(simulated_balance, 2)})

@app.route("/analyze", methods=["POST"])
def analyze():
    update_activity()
    data = request.json or {}
    pair = data.get("pair", "EURUSD")
    
    has_news, news_reason = check_news_filter(pair)
    if has_news:
        return jsonify({
            "status": "success",
            "direction": "NONE",
            "logs": [{"timestamp": time.time(), "message": f"[FILTRO NOTICIAS] {news_reason}"}]
        })

    return jsonify({
        "status": "success",
        "direction": "NONE",
        "probability": 0,
        "logs": [{"timestamp": time.time(), "message": "[SYSTEM] MT5 Worker scaffold - Análisis simulado (sin data)"}]
    })

@app.route("/trade", methods=["POST"])
def trade():
    update_activity()
    return jsonify({"status": "error", "message": "Trading no implementado en el scaffold MT5"})

@app.route("/advisor", methods=["POST"])
def advisor():
    update_activity()
    data = request.json or {}
    recent_trades = data.get("recentTrades", [])
    recommendation = evaluate_strategy_mode(recent_trades)
    return jsonify({"status": "success", "recommendation": recommendation})

@app.route("/ping", methods=["GET"])
def ping():
    update_activity()
    return jsonify({"status": "ok", "worker": "mt5", "port": WORKER_PORT})

if __name__ == "__main__":
    print(f"[MT5 WORKER] Iniciando en puerto {WORKER_PORT}...")
    app.run(host="127.0.0.1", port=WORKER_PORT, debug=False, threaded=True)
