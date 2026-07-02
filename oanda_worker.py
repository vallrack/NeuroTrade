import os
import sys
import time
import json
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import random

from indicators import (
    DEFAULT_MIN_RSI,
    DEFAULT_MAX_RSI,
    check_news_filter,
    evaluate_strategy_mode
)

WORKER_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5004

app = Flask(__name__)
CORS(app)

last_activity = time.time()
INACTIVITY_TIMEOUT = 3600
session_active = False

def update_activity():
    global last_activity
    last_activity = time.time()

def check_inactivity():
    while True:
        time.sleep(60)
        if time.time() - last_activity > INACTIVITY_TIMEOUT:
            print(f"[OANDA WORKER {WORKER_PORT}] Inactividad. Apagando...")
            os._exit(0)

threading.Thread(target=check_inactivity, daemon=True).start()

@app.route("/connect", methods=["POST"])
def connect():
    update_activity()
    global session_active
    session_active = True
    return jsonify({"status": "success", "message": "Conectado a OANDA (Scaffold)"})

@app.route("/disconnect", methods=["POST"])
def disconnect():
    update_activity()
    global session_active
    session_active = False
    return jsonify({"status": "success", "message": "Desconectado de OANDA"})

@app.route("/balance", methods=["GET"])
def balance():
    update_activity()
    return jsonify({"status": "success", "balance": round(random.uniform(500, 2000), 2)})

@app.route("/analyze", methods=["POST"])
def analyze():
    update_activity()
    return jsonify({"status": "success", "direction": "NONE", "probability": 0, "logs": []})

@app.route("/trade", methods=["POST"])
def trade():
    update_activity()
    return jsonify({"status": "error", "message": "Trading no implementado en scaffold OANDA"})

@app.route("/advisor", methods=["POST"])
def advisor():
    update_activity()
    data = request.json or {}
    recommendation = evaluate_strategy_mode(data.get("recentTrades", []))
    return jsonify({"status": "success", "recommendation": recommendation})

@app.route("/ping", methods=["GET"])
def ping():
    update_activity()
    return jsonify({"status": "ok", "worker": "oanda", "port": WORKER_PORT})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=WORKER_PORT, debug=False, threaded=True)
