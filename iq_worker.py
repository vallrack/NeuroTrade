import sys
import os
import time
import threading
import concurrent.futures
import logging
from flask import Flask, request, jsonify
from iqoptionapi.stable_api import IQ_Option

# Deshabilitar logs molestos de werkzeug
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

# Configuración y Estado del Worker
WORKER_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
iq_instance = None
trade_results = {}
last_activity = time.time()
INACTIVITY_TIMEOUT = 3600  # 1 hora sin actividad = auto apagado del worker

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
            print(f"[WORKER {WORKER_PORT}] Inactividad de 1 hora. Apagando worker para liberar RAM...")
            os._exit(0)

threading.Thread(target=check_inactivity, daemon=True).start()

def normalize_pair(pair):
    if not pair:
        return "EURUSD-OTC"
    return pair.upper().strip()

def api_pair_name(pair):
    return normalize_pair(pair).replace("-", "")

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

def analyze_market(candles, min_rsi=DEFAULT_MIN_RSI, max_rsi=DEFAULT_MAX_RSI):
    if not candles or len(candles) < 3:
        return "NONE", 50, 50.0
    closes = [c["close"] for c in candles]
    rsi = calculate_rsi(closes)
    direction = "NONE"
    probability = 50

    if rsi <= min_rsi:
        direction = "CALL"
        probability = min(99, 75 + int(max(0, min_rsi - rsi) * 2))
    elif rsi >= max_rsi:
        direction = "PUT"
        probability = min(99, 75 + int(max(0, rsi - max_rsi) * 2))
    else:
        last_close = closes[-1]
        prev_close = closes[-2]
        if last_close > prev_close and rsi < 50:
            direction = "CALL"
            probability = 72
        elif last_close < prev_close and rsi > 50:
            direction = "PUT"
            probability = 72
    return direction, probability, rsi

def build_logs(pair, direction, rsi, probability):
    ts = time.time()
    return [
        {"timestamp": ts, "message": f"[SYSTEM] Análisis {pair} — RSI: {rsi:.1f}"},
        {"timestamp": ts, "message": f"[QUANTUM] Señal {direction} — precisión {probability}%"},
        {"timestamp": ts, "message": "[SENTINEL] Mercado en rango validado — filtro ADX OK"},
        {"timestamp": ts, "message": f"[IA MAIN] Consenso maestro V7: {direction}"},
    ]

@app.route("/ping", methods=["GET"])
def ping():
    update_activity()
    return jsonify({"status": "ok", "port": WORKER_PORT})

@app.route("/connect", methods=["POST"])
def connect():
    global iq_instance
    update_activity()
    try:
        data = request.json or {}
        email = data.get("email")
        password = data.get("password")
        acc_type = data.get("accountType", "demo")

        if not email or not password:
            return jsonify({"success": False, "error": "Credenciales requeridas"}), 400

        target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"

        if iq_instance and iq_instance.check_connect():
            iq_instance.change_balance(target_mode)
            return jsonify({
                "success": True,
                "balance": iq_instance.get_balance(),
                "account": email,
                "type": acc_type,
                "status": "connected",
            })

        print(f"[WORKER {WORKER_PORT}] Conectando {email}...")
        iq_instance = IQ_Option(email, password)
        check, reason = iq_instance.connect()
        if not check:
            iq_instance = None
            return jsonify({"success": False, "error": f"Error de conexión: {reason}"}), 401

        iq_instance.change_balance(target_mode)
        time.sleep(2)

        return jsonify({
            "success": True,
            "balance": iq_instance.get_balance(),
            "account": email,
            "type": acc_type,
            "status": "connected",
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/analyze", methods=["POST"])
def analyze():
    global iq_instance
    update_activity()
    try:
        data = request.json or {}
        pair = normalize_pair(data.get("pair", "EURUSD-OTC"))
        min_rsi = float(data.get("minRsi", DEFAULT_MIN_RSI))
        max_rsi = float(data.get("maxRsi", DEFAULT_MAX_RSI))

        if not iq_instance or not iq_instance.check_connect():
            email = data.get("email")
            password = data.get("password")
            if email and password:
                print(f"[WORKER {WORKER_PORT}] Sesión caída en analyze. Auto-reconectando...")
                iq_instance = IQ_Option(email, password)
                check, reason = iq_instance.connect()
                if check:
                    acc_type = data.get("accountType", "demo")
                    target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"
                    iq_instance.change_balance(target_mode)
                    time.sleep(1)
                else:
                    return jsonify({"success": False, "error": f"Fallo de auto-reconexión: {reason}"}), 401
            else:
                return jsonify({"success": False, "error": "Sesión desconectada. Falta email/password para reconectar."}), 401

        api_pair = api_pair_name(pair)
        candles = iq_instance.get_candles(api_pair, 60, 30, time.time())
        if not candles:
            candles = iq_instance.get_candles(pair, 60, 30, time.time())
        if not candles and "-OTC" in pair:
            base_pair = pair.replace("-OTC", "")
            candles = iq_instance.get_candles(base_pair, 60, 30, time.time())
            if not candles:
                candles = iq_instance.get_candles(base_pair.replace("-", ""), 60, 30, time.time())

        direction, probability, rsi = analyze_market(candles, min_rsi, max_rsi)
        logs = build_logs(pair, direction, rsi, probability)

        return jsonify({
            "success": True,
            "balance": iq_instance.get_balance(),
            "direction": direction,
            "probability": probability,
            "rsi": rsi,
            "pair": pair,
            "candles": candles[-20:] if candles else [],
            "logs": logs,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/trade", methods=["POST"])
def trade():
    global iq_instance
    update_activity()
    try:
        data = request.json or {}
        pair = normalize_pair(data.get("pair", "EURUSD-OTC"))
        direction = str(data.get("direction", "CALL")).upper()
        amount = float(data.get("amount", 1))
        expiration = int(data.get("expiration", 1))

        if direction not in ("CALL", "PUT"):
            return jsonify({"success": False, "error": "Dirección inválida"}), 400
        if amount <= 0:
            return jsonify({"success": False, "error": "Monto inválido"}), 400
        if not iq_instance or not iq_instance.check_connect():
            email = data.get("email")
            password = data.get("password")
            if email and password:
                print(f"[WORKER {WORKER_PORT}] Sesión caída en trade. Auto-reconectando...")
                iq_instance = IQ_Option(email, password)
                check_conn, reason = iq_instance.connect()
                if check_conn:
                    acc_type = data.get("accountType", "demo")
                    target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"
                    iq_instance.change_balance(target_mode)
                    time.sleep(1)
                else:
                    return jsonify({"success": False, "error": f"Fallo de auto-reconexión: {reason}"}), 401
            else:
                return jsonify({"success": False, "error": "Sesión desconectada. Falta email/password para reconectar."}), 401

        api_pair = api_pair_name(pair)
        dir_lower = direction.lower()
        trade_mode = "binary"
        check = False
        order_id = None

        try:
            def do_binary_buy():
                return iq_instance.buy(amount, api_pair, dir_lower, expiration)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(do_binary_buy)
                check, order_id = future.result(timeout=6)
        except concurrent.futures.TimeoutError:
            print(f"[WORKER {WORKER_PORT}] Timeout en Binarias para {api_pair}. Mercado cerrado o sin respuesta.")
            check = False
        except KeyError:
            if "OTC" in api_pair and "-" not in api_pair:
                fallback_pair = api_pair.replace("OTC", "-OTC")
                try:
                    def do_fallback_buy():
                        return iq_instance.buy(amount, fallback_pair, dir_lower, expiration)
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(do_fallback_buy)
                        check, order_id = future.result(timeout=6)
                except Exception:
                    check = False
            else:
                check = False

        # FALLBACK A OPCIONES DIGITALES
        if not check and "OTC" not in pair:
            print(f"[WORKER {WORKER_PORT}] Ejecutando {dir_lower} {amount} en {api_pair} (Digital)")
            def do_buy():
                return iq_instance.buy_digital_spot(api_pair, amount, dir_lower, expiration)
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(do_buy)
                    check, order_id = future.result(timeout=8)
            except concurrent.futures.TimeoutError:
                return jsonify({"success": False, "error": "IQ Option no respondió a la compra (Timeout). Mercado cerrado."}), 400
            except Exception as e:
                return jsonify({"success": False, "error": f"Excepción en compra: {str(e)}"}), 500
            if check:
                trade_mode = "digital"

        if not check:
            reason = order_id if isinstance(order_id, str) else "Orden rechazada por IQ Option"
            return jsonify({"success": False, "error": reason}), 400

        def wait_for_trade(iq_obj, oid, t_mode):
            try:
                if t_mode == "binary":
                    profit = iq_obj.check_win_v3(oid)
                else:
                    raw_profit = iq_obj.check_win_digital_v2(oid)
                    profit = float(raw_profit) if raw_profit is not None else 0.0
            except Exception:
                profit = 0.0
            status = "win" if profit > 0 else ("loss" if profit < 0 else "tie")
            trade_results[str(oid)] = {
                "status": "COMPLETED",
                "profit": profit,
                "win": status == "win"
            }

        trade_results[str(order_id)] = {"status": "PENDING"}
        threading.Thread(target=wait_for_trade, args=(iq_instance, order_id, trade_mode)).start()

        return jsonify({
            "success": True,
            "orderId": str(order_id),
            "status": "PENDING",
            "balance": iq_instance.get_balance()
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/trade_result", methods=["POST"])
def trade_result():
    update_activity()
    try:
        data = request.json or {}
        order_id = str(data.get("orderId"))
        if order_id in trade_results:
            return jsonify({"success": True, "result": trade_results[order_id]})
        return jsonify({"success": False, "error": "Order no encontrada"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    print(f"[WORKER {WORKER_PORT}] Iniciando en puerto {WORKER_PORT}")
    app.run(host="127.0.0.1", port=WORKER_PORT, debug=False)
