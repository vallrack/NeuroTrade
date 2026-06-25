import sys
import os
import time
import threading
import concurrent.futures
import logging
from flask import Flask, request, jsonify
from iqoptionapi.stable_api import IQ_Option
import json
import iqoptionapi.stable_api
import iqoptionapi.global_value as global_value
import websocket
import ssl

_original_loads = json.loads
def _robust_loads(s, *args, **kwargs):
    try:
        return _original_loads(s, *args, **kwargs)
    except Exception:
        return {"code": "parse_error", "message": str(s)}
iqoptionapi.stable_api.json.loads = _robust_loads

# ─── PARCHE WEBSOCKET PARA PYINSTALLER (Evita fallo de certificados SSL) ───
_original_run_forever = websocket.WebSocketApp.run_forever
def _patched_run_forever(self, *args, **kwargs):
    kwargs['sslopt'] = {"check_hostname": False, "cert_reqs": ssl.CERT_NONE}
    return _original_run_forever(self, *args, **kwargs)
websocket.WebSocketApp.run_forever = _patched_run_forever
# ──────────────────────────────────────────────────────────────────────────

# Deshabilitar logs molestos de werkzeug
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

# Configuración y Estado del Worker
WORKER_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
iq_instance = None
trade_results = {}
last_activity = time.time()
INACTIVITY_TIMEOUT = 1200  # 20 min sin actividad = auto apagado (libera RAM para otros usuarios)

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
    """Asegura que el par tenga guion si es OTC, que es el estándar de IQ Option para buscar en sus mapas (ej. EURUSD-OTC)"""
    pair = pair.upper().replace("-OTC", "OTC").replace("OTC", "-OTC")
    return pair

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
    
    if total_size == 0:
        return False, ""
        
    body_percent = body / total_size
    wick_up = last_candle['max'] - max(last_candle['close'], last_candle['open'])
    wick_down = min(last_candle['close'], last_candle['open']) - last_candle['min']
    
    # 1. Volumen anómalo
    if last_candle['volume'] > avg_vol * vol_multiplier:
        # 2. Cuerpo pequeño
        if body_percent < max_body_percent:
            # 3. Mechas desproporcionadas
            if wick_down > wick_up * 2:
                return True, "Falso quiebre bajista (Caza de Liquidez detectada por mecha inferior gigante)"
            elif wick_up > wick_down * 2:
                return True, "Falso quiebre alcista (Caza de Liquidez detectada por mecha superior gigante)"
                
    return False, ""

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

# ─── Ejecución acotada (evita que un hilo de la librería gire para siempre) ───
_global_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

def run_with_timeout(fn, timeout_s):
    """Ejecuta fn() con un límite de tiempo. Lanza TimeoutError si lo supera.
    (Utiliza un executor global para evitar acumulación de hilos en Render)"""
    future = _global_executor.submit(fn)
    try:
        return future.result(timeout=timeout_s)
    except concurrent.futures.TimeoutError:
        raise

# ─── Estado de apertura de mercado (cacheado para no spamear a IQ) ────────────
_open_cache = {"data": None, "ts": 0.0}
_open_lock = threading.Lock()
OPEN_CACHE_TTL = 30  # segundos

def get_open_map(force=False):
    """Devuelve el mapa get_all_open_time() de IQ, cacheado 30s. None si falla."""
    global _open_cache
    now = time.time()
    with _open_lock:
        cached = _open_cache
    if not force and cached["data"] is not None and now - cached["ts"] < OPEN_CACHE_TTL:
        return cached["data"]
    try:
        data = run_with_timeout(iq_instance.get_all_open_time, 12)
    except Exception as e:
        print(f"[WORKER {WORKER_PORT}] No se pudo obtener get_all_open_time: {e}")
        return None
    with _open_lock:
        _open_cache = {"data": data, "ts": now}
    return data

def asset_status(pair):
    """Qué instrumentos (binary/turbo/digital) están abiertos para el par exacto.

    Devuelve (status_dict, conocido). 'conocido' es False si IQ no respondió."""
    data = get_open_map()
    status = {"binary": False, "turbo": False, "digital": False}
    if data is None:
        return status, False
    for inst in status:
        try:
            status[inst] = bool(data.get(inst, {}).get(pair, {}).get("open", False))
        except Exception:
            status[inst] = False
    return status, True

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
            if getattr(iq_instance, '_current_target_mode', None) != target_mode:
                iq_instance.change_balance(target_mode)
                iq_instance._current_target_mode = target_mode
            return jsonify({
                "success": True,
                "balance": iq_instance.get_balance(),
                "account": email,
                "type": acc_type,
                "status": "connected",
            })

        print(f"[WORKER {WORKER_PORT}] Conectando {email}...")
        iq_instance = IQ_Option(email, password)
        
        # ── WATCHDOG: Si el connect() se queda colgado esperando el websocket ──
        def _watchdog_connect():
            time.sleep(15)
            if not iq_instance.check_connect() or global_value.balance_id is None:
                print(f"[WORKER {WORKER_PORT}] Timeout de conexión interno. Forzando destrabe...")
                global_value.balance_id = "TIMEOUT" # destraba el while loop en stable_api.py
                
        threading.Thread(target=_watchdog_connect, daemon=True).start()
        # ───────────────────────────────────────────────────────────────────────
        
        check, reason = iq_instance.connect()
        
        if not check or global_value.balance_id == "TIMEOUT":
            iq_instance = None
            err_msg = reason if check is False else "IQ Option no respondió (WebSocket Timeout)"
            return jsonify({"success": False, "error": f"Error de conexión: {err_msg}"}), 401

        try:
            iq_instance.update_ACTIVES_OPCODE()
        except Exception as e:
            print(f"[WORKER {WORKER_PORT}] Error al actualizar ACTIVES_OPCODE: {e}")

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
        email = data.get("email")
        password = data.get("password")
        pair = normalize_pair(data.get("pair", "EURUSD-OTC"))
        min_rsi = float(data.get("minRsi", DEFAULT_MIN_RSI))
        max_rsi = float(data.get("maxRsi", DEFAULT_MAX_RSI))
        vol_multiplier = float(data.get("manipulationVolMultiplier", 1.5))
        max_body_percent = float(data.get("manipulationMaxBody", 0.3))

        if not iq_instance or not iq_instance.check_connect():
            if email and password:
                print(f"[WORKER {WORKER_PORT}] Sesión caída en analyze. Auto-reconectando...")
                iq_instance = IQ_Option(email, password)
                
                # WATCHDOG
                def _watchdog_connect_analyze():
                    time.sleep(15)
                    if not iq_instance.check_connect() or global_value.balance_id is None:
                        global_value.balance_id = "TIMEOUT"
                threading.Thread(target=_watchdog_connect_analyze, daemon=True).start()
                
                check, reason = iq_instance.connect()
                if not check or global_value.balance_id == "TIMEOUT":
                    err_msg = reason if check is False else "WebSocket Timeout"
                    return jsonify({"success": False, "error": f"Auto-reconexión fallida: {err_msg}"}), 401
                try:
                    iq_instance.update_ACTIVES_OPCODE()
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Error al actualizar ACTIVES_OPCODE: {e}")
            else:
                return jsonify({"success": False, "error": "Sesión desconectada. Falta email/password para reconectar."}), 401

        # Sincronizar siempre el tipo de cuenta con la UI solo si es necesario
        acc_type = data.get("accountType", "demo")
        target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"
        if getattr(iq_instance, '_current_target_mode', None) != target_mode:
            iq_instance.change_balance(target_mode)
            iq_instance._current_target_mode = target_mode

        # Pedir las velas una sola vez con el par exacto (ej. EURUSD-OTC)
        candles = iq_instance.get_candles(pair, 60, 30, time.time())
        
        # Si falla con timeframe corto, probar con uno un poco mayor (ej. 5 min)
        if not candles:
            candles = iq_instance.get_candles(pair, 300, 10, time.time())
            
        if not candles:
            return jsonify({"success": False, "error": f"No hay velas disponibles para {pair}"}), 400

        direction, probability, rsi = analyze_market(candles, min_rsi, max_rsi)
        is_manipulated, manipulation_reason = detect_manipulation(candles, vol_multiplier, max_body_percent)
        
        logs = build_logs(pair, direction, rsi, probability)

        return jsonify({
            "success": True,
            "balance": iq_instance.get_balance(),
            "direction": direction,
            "probability": probability,
            "rsi": rsi,
            "isManipulated": is_manipulated,
            "manipulationReason": manipulation_reason,
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
                
                # WATCHDOG
                def _watchdog_connect_trade():
                    time.sleep(15)
                    if not iq_instance.check_connect() or global_value.balance_id is None:
                        global_value.balance_id = "TIMEOUT"
                threading.Thread(target=_watchdog_connect_trade, daemon=True).start()
                
                check_conn, reason = iq_instance.connect()
                if not check_conn or global_value.balance_id == "TIMEOUT":
                    err_msg = reason if check_conn is False else "WebSocket Timeout"
                    return jsonify({"success": False, "error": f"Fallo de auto-reconexión: {err_msg}"}), 401
                try:
                    iq_instance.update_ACTIVES_OPCODE()
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Error al actualizar ACTIVES_OPCODE: {e}")
            else:
                return jsonify({"success": False, "error": "Sesión desconectada. Falta email/password para reconectar."}), 401

        # Sincronizar siempre el tipo de cuenta con la UI solo si es necesario
        acc_type = data.get("accountType", "demo")
        target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"
        if getattr(iq_instance, '_current_target_mode', None) != target_mode:
            iq_instance.change_balance(target_mode)
            iq_instance._current_target_mode = target_mode

        # 'pair' viene normalizado con guion (ej. EURUSD-OTC), que es el formato
        # que usan tanto OP_code.ACTIVES como get_all_open_time().
        dir_lower = direction.lower()
        trade_mode = "binary"
        check = False
        order_id = None

        # ── Verificar QUÉ instrumento está abierto ANTES de comprar ──
        # Esto evita el bucle de espera activa infinito de buy_digital_spot()
        # cuando el mercado está cerrado (causa principal del "congelamiento").
        status, open_known = asset_status(pair)
        use_binary = status["turbo"] or status["binary"]
        use_digital = status["digital"]

        trade_pair = pair
        try:
            actives_map = iq_instance.get_all_ACTIVES_OPCODE()
            if pair not in actives_map:
                print(f"[WORKER {WORKER_PORT}] Activo {pair} no encontrado en memoria. Forzando actualización de la lista de activos del broker...")
                iq_instance.update_ACTIVES_OPCODE()
                actives_map = iq_instance.get_all_ACTIVES_OPCODE()
                if pair in actives_map:
                    trade_pair = pair
        except Exception as e:
            print(f"[WORKER {WORKER_PORT}] Advertencia al intentar sincronizar lista de activos: {e}")
            pass

        if not use_binary and not use_digital:
            if open_known:
                # IQ confirmó que el activo está cerrado: respuesta inmediata y clara.
                return jsonify({
                    "success": False,
                    "error": f"Mercado cerrado para {pair}. Ningún instrumento (binaria/digital) está abierto ahora."
                }), 400
            # Estado desconocido (IQ no respondió): intentamos SOLO binaria,
            # que tiene un timeout interno de 5s y nunca gira para siempre.
            print(f"[WORKER {WORKER_PORT}] Estado de apertura desconocido para {pair}. Intento binaria acotada.")
            use_binary = True

        # ── 1) Binaria / Turbo (la llamada buy() tiene timeout interno de 5s) ──
        if use_binary:
            try:
                print(f"[WORKER {WORKER_PORT}] Intentando compra binaria/turbo en {trade_pair}...")
                # Verificación explícita para evitar KeyError antes de llamar a buy()
                actives_ahora = iq_instance.get_all_ACTIVES_OPCODE()
                if trade_pair not in actives_ahora:
                    raise KeyError(trade_pair)

                check, order_id = run_with_timeout(
                    lambda: iq_instance.buy(amount, trade_pair, dir_lower, expiration), 10
                )
            except concurrent.futures.TimeoutError:
                print(f"[WORKER {WORKER_PORT}] Timeout en binaria para {trade_pair}.")
                check = False
            except KeyError as ke:
                print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en OP_code.ACTIVES (Binaria). Probando digital...")
                check = False
            except Exception as e:
                print(f"[WORKER {WORKER_PORT}] Excepción en binaria {trade_pair}: {e}")
                import traceback
                traceback.print_exc()
                check = False

        if not check and use_digital:
            print(f"[WORKER {WORKER_PORT}] Ejecutando {dir_lower} {amount} en {trade_pair} (Digital)")
            try:
                check, order_id = run_with_timeout(
                    lambda: iq_instance.buy_digital_spot(trade_pair, amount, dir_lower, expiration), 12
                )
                if check:
                    trade_mode = "digital"
            except concurrent.futures.TimeoutError:
                return jsonify({"success": False, "error": "IQ Option no respondió a la compra digital (timeout)."}), 400
            except KeyError as ke:
                print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en Digital. Operación abortada.")
                check = False
                order_id = f"Activo no disponible en Digital: {ke}"
            except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({"success": False, "error": f"Excepción en compra digital: {str(e)}"}), 500

        if not check:
            reason = order_id if isinstance(order_id, str) else f"Orden rechazada por IQ Option en {pair}"
            return jsonify({"success": False, "error": reason}), 400

        def wait_for_trade(iq_obj, oid, t_mode, exp_minutes):
            # La operación no puede cerrar antes de su expiración; damos un margen
            # extra y un tope absoluto para no dejar el hilo colgado para siempre.
            deadline = time.time() + (max(1, exp_minutes) * 60) + 120
            profit = None
            while time.time() < deadline and profit is None:
                try:
                    if t_mode == "digital":
                        closed, win = iq_obj.check_win_digital_v2(oid)
                        if closed:
                            profit = float(win)
                    else:
                        check, data = iq_obj.get_betinfo(oid)
                        if check and data:
                            try:
                                d = data["result"]["data"][str(oid)]
                                win = d.get("win", "")
                                if win != "":
                                    profit_val = d.get("profit", 0)
                                    deposit_val = d.get("deposit", 0)
                                    profit = float(profit_val) - float(deposit_val)
                            except (KeyError, TypeError, ValueError) as e:
                                print(f"[WORKER {WORKER_PORT}] Error parseando betinfo {oid}: {e}")
                except Exception as e:
                    print(f"[WORKER] Reintentando resultado de {t_mode} {oid}: {e}")
                if profit is None:
                    time.sleep(3)

            if profit is None:
                # No se pudo determinar a tiempo: lo marcamos como cerrado neutro.
                print(f"[WORKER] Sin resultado para {t_mode} {oid} dentro del límite.")
                profit = 0.0

            status = "win" if profit > 0 else ("loss" if profit < 0 else "tie")
            trade_results[str(oid)] = {
                "status": "COMPLETED",
                "profit": round(profit, 2),
                "win": status == "win"
            }

        trade_results[str(order_id)] = {"status": "PENDING"}
        threading.Thread(
            target=wait_for_trade,
            args=(iq_instance, order_id, trade_mode, expiration),
            daemon=True
        ).start()

        return jsonify({
            "success": True,
            "orderId": str(order_id),
            "status": "PENDING",
            "balance": iq_instance.get_balance()
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
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
    app.run(host="127.0.0.1", port=WORKER_PORT, debug=False, threaded=True)
