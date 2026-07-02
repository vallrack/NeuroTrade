import sys
import os
import time
import threading
import concurrent.futures
import logging
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
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
iq_instance = None
last_activity = time.time()
INACTIVITY_TIMEOUT = 3600  # FIX #10: Extendido a 60 min (antes 20) para sesiones largas sin señales

# FIX #4: Lock para prevenir condición de carrera al cambiar de cuenta demo/real
_balance_change_lock = threading.Lock()

# Umbrales
DEFAULT_MIN_RSI = 38
DEFAULT_MAX_RSI = 62

# ─── FALLA #1 FIX: Persistencia de resultados en disco ────────────────────────
# trade_results se guarda también en un archivo .json para sobrevivir reinicios
# del worker (evita pérdida de operaciones que estaban PENDING al caerse).
RESULTS_CACHE_FILE = f"trade_results_cache_{WORKER_PORT}.json"

def _load_trade_cache():
    """Carga resultados previos del disco al arrancar (recuperación tras crash)."""
    try:
        if os.path.exists(RESULTS_CACHE_FILE):
            with open(RESULTS_CACHE_FILE, 'r') as f:
                data = json.load(f)
                print(f"[WORKER {WORKER_PORT}] Recuperados {len(data)} resultados del caché en disco.")
                return data
    except Exception as e:
        print(f"[WORKER {WORKER_PORT}] No se pudo cargar caché de resultados: {e}")
    return {}

def _persist_result(order_id, result):
    """Guarda un resultado en RAM y en disco."""
    trade_results[str(order_id)] = result
    try:
        with open(RESULTS_CACHE_FILE, 'w') as f:
            json.dump(trade_results, f)
    except Exception as e:
        print(f"[WORKER {WORKER_PORT}] Aviso: no se pudo persistir resultado en disco: {e}")

trade_results = _load_trade_cache()

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

def run_with_timeout(func, timeout_sec):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func)
        return future.result(timeout=timeout_sec)

def smart_change_balance(iq, target_mode):
    try:
        profile = iq.get_profile_ansyc()
        balances = profile.get("balances", [])
        
        target_type = 4 if target_mode == "PRACTICE" else 1
        filtered = [b for b in balances if b.get("type") == target_type]
        
        if filtered:
            # Seleccionar el balance con mayor saldo (evita elegir un balance USD en 0 si hay uno COP con saldo)
            best_balance = max(filtered, key=lambda x: float(x.get("amount", 0)))
            best_id = best_balance.get("id")
            
            if global_value.balance_id != None:
                iq.position_change_all("unsubscribeMessage", global_value.balance_id)
                
            global_value.balance_id = best_id
            iq.position_change_all("subscribeMessage", best_id)
            return True
    except Exception as e:
        print(f"Error en smart_change_balance: {e}")
        
    # Fallback al original
    try:
        iq.change_balance(target_mode)
        return True
    except:
        pass
    return False



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
    return


@app.after_request
def add_pna_headers(response):
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

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
                time.sleep(0.5) # Wait for websocket balance sync
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

@app.route("/actives", methods=["POST"])
def get_actives():
    global iq_instance
    update_activity()
    try:
        data = request.json or {}
        email = data.get("email")
        password = data.get("password")
        
        if not iq_instance or not iq_instance.check_connect():
            if email and password:
                print(f"[WORKER {WORKER_PORT}] Sesión caída en actives. Auto-reconectando...")
                iq_instance = IQ_Option(email, password)
                check, _ = iq_instance.connect()
                if not check:
                    return jsonify({"success": False, "error": "Auto-reconexión fallida"}), 401
            else:
                return jsonify({"success": False, "error": "No conectado"}), 401
                
        # Sincronizar activos
        iq_instance.update_ACTIVES_OPCODE()
        
        # Esperar un poco a que el websocket reciba la respuesta de activos
        actives_map = {}
        for _ in range(5):
            actives_map = iq_instance.get_all_ACTIVES_OPCODE()
            if actives_map:
                break
            time.sleep(1)
            
        all_pairs = [k for k, v in actives_map.items() if v]
        otc = [p for p in all_pairs if "-OTC" in p]
        regular = [p for p in all_pairs if "-OTC" not in p]
        
        return jsonify({
            "success": True, 
            "pairs": all_pairs,
            "otc": otc,
            "regular": regular
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

        # ─── FALLA #3 FIX: Filtro de noticias desde el frontend ───────────────
        # El frontend envía los pares afectados por noticias de alto impacto.
        # Retornamos NONE inmediatamente sin operar si el par está bloqueado.
        blocked_pairs = data.get("blockedPairs", [])
        if blocked_pairs and any(bp.upper() in pair.upper() for bp in blocked_pairs):
            print(f"[WORKER {WORKER_PORT}] Par {pair} bloqueado por noticia de alto impacto.")
            bal = 0
            try:
                bal = iq_instance.get_balance() if iq_instance else 0
            except:
                pass
            return jsonify({
                "success": True,
                "direction": "NONE",
                "probability": 0,
                "rsi": 50,
                "isManipulated": False,
                "manipulationReason": f"Par bloqueado por noticia de alto impacto (Calendario Económico)",
                "balance": bal,
                "pair": pair,
                "candles": [],
                "logs": [{"timestamp": time.time(), "message": f"[SENTINEL] Par {pair} bloqueado por calendario económico (señal del frontend)."}]
            })

        # ─── FALLA #3 FIX: Filtro de noticias DIRECTO en Python (consulta ForexFactory) ──
        # Este es el filtro primario — Python mismo consulta el calendario cada 15 min.
        # El blockedPairs del frontend (arriba) es el filtro de respaldo.
        has_news_py, news_reason_py = check_news_filter(pair)
        if has_news_py:
            print(f"[WORKER {WORKER_PORT}] BLOQUEADO por Python news filter: {news_reason_py}")
            bal = 0
            try:
                bal = iq_instance.get_balance() if iq_instance else 0
            except:
                pass
            return jsonify({
                "success": True,
                "direction": "NONE",
                "probability": 0,
                "rsi": 50,
                "isManipulated": False,
                "manipulationReason": news_reason_py,
                "balance": bal,
                "pair": pair,
                "candles": [],
                "logs": [{"timestamp": time.time(), "message": f"[SENTINEL] {news_reason_py} — Operación bloqueada automáticamente."}]
            })

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
        # FIX #4: Lock para evitar que dos requests simultáneos cambien de cuenta a la vez
        with _balance_change_lock:
            if getattr(iq_instance, '_current_target_mode', None) != target_mode:
                smart_change_balance(iq_instance, target_mode)
                iq_instance._current_target_mode = target_mode
                time.sleep(0.5) # Wait for websocket balance sync

        # Pedir las velas una sola vez con el par exacto (ej. EURUSD-OTC)
        # Pedimos 250 velas para poder calcular la EMA 200 de forma precisa
        candles = iq_instance.get_candles(pair, 60, 250, time.time())
        
        # Si falla con timeframe corto, probar con uno un poco mayor (ej. 5 min)
        if not candles:
            candles = iq_instance.get_candles(pair, 300, 250, time.time())
            
        if not candles:
            return jsonify({"success": False, "error": f"No hay velas disponibles para {pair}"}), 400

        # Buscar el balance correcto iterando get_balances()
        target_type = 4 if acc_type.lower() == "demo" else 1
        real_balance = getattr(global_value, 'balance', 0)
        try:
            balances = iq_instance.get_profile_ansyc().get("balances", [])
            for b in balances:
                if b.get("id") == global_value.balance_id:
                    real_balance = b.get("amount")
                    break
        except Exception as e:
            # FIX #9: Avisar que estamos usando balance cacheado (puede estar desactualizado)
            print(f"[WORKER {WORKER_PORT}] Aviso: usando balance del caché WebSocket (get_profile_ansyc falló: {e})")
            real_balance = getattr(global_value, 'balance', 0)
            
        direction, probability, rsi, ema_200, upper_band, lower_band, last_close, atr, macd_val, signal_val = analyze_market(candles, min_rsi, max_rsi)
        is_manipulated, manipulation_reason = detect_manipulation(candles, vol_multiplier, max_body_percent)
        
        logs = build_logs(pair, direction, rsi, probability, ema_200, upper_band, lower_band, last_close, atr, macd_val, signal_val)

        # ─── Consejo IA: evaluar el rendimiento reciente y recomendar estrategia ──
        # El frontend puede enviar el historial de trades recientes para análisis.
        recent_trades_data = data.get("recentTrades", [])
        strategy_advice = evaluate_strategy_mode(recent_trades_data)

        return jsonify({
            "success": True,
            "balance": real_balance,
            "direction": direction,
            "probability": probability,
            "rsi": rsi,
            "isManipulated": is_manipulated,
            "manipulationReason": manipulation_reason,
            "pair": pair,
            "candles": candles[-20:] if candles else [],
            "logs": logs,
            # ─── NUEVO: Indicadores avanzados para el frontend ─────────────────
            "macd": {"macd": macd_val, "signal": signal_val, "histogram": round(macd_val - signal_val, 8) if macd_val and signal_val else None},
            "atr": atr,
            "ema200": ema_200,
            # ─── NUEVO: Recomendación del Consejo IA ──────────────────────────
            "strategy_recommendation": strategy_advice,
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

        # FIX #4: Lock para evitar condición de carrera demo/real en /trade
        acc_type = data.get("accountType", "demo")
        target_mode = "PRACTICE" if acc_type.lower() == "demo" else "REAL"
        with _balance_change_lock:
            if getattr(iq_instance, '_current_target_mode', None) != target_mode:
                smart_change_balance(iq_instance, target_mode)
                iq_instance._current_target_mode = target_mode
                time.sleep(0.5)

        # 'pair' viene normalizado con guion (ej. EURUSD-OTC), que es el formato
        # que usan tanto OP_code.ACTIVES como get_all_open_time().
        dir_lower = direction.lower()
        trade_mode = "binary"
        check = False
        order_id = None



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


        # Smart Fallback para elegir binaria vs digital
        print(f"[WORKER {WORKER_PORT}] Smart Fallback para {pair}. Evaluando binaria o digital...")
        if "-OTC" in pair:
            try_first, try_second = "digital", "binary"
        else:
            try_first, try_second = "binary", "digital"

        def attempt_trade(mode):
            nonlocal check, order_id, trade_mode
            if mode == "binary":
                try:
                    print(f"[WORKER {WORKER_PORT}] Intentando compra binaria/turbo en {trade_pair}...")
                    actives_ahora = iq_instance.get_all_ACTIVES_OPCODE()
                    if trade_pair not in actives_ahora:
                        raise KeyError(trade_pair)

                    ok, oid = run_with_timeout(
                        lambda: iq_instance.buy(amount, trade_pair, dir_lower, expiration), 10
                    )
                    if ok:
                        check, order_id, trade_mode = True, oid, "binary"
                except concurrent.futures.TimeoutError:
                    print(f"[WORKER {WORKER_PORT}] Timeout en binaria para {trade_pair}.")
                except KeyError as ke:
                    print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en OP_code.ACTIVES (Binaria).")
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Excepción en binaria {trade_pair}: {e}")

            elif mode == "digital":
                print(f"[WORKER {WORKER_PORT}] Ejecutando {dir_lower} {amount} en {trade_pair} (Digital)")
                try:
                    ok, oid = run_with_timeout(
                        lambda: iq_instance.buy_digital_spot(trade_pair, amount, dir_lower, expiration), 12
                    )
                    if ok:
                        check, order_id, trade_mode = True, oid, "digital"
                except concurrent.futures.TimeoutError:
                    print(f"[WORKER {WORKER_PORT}] Timeout en digital para {trade_pair}.")
                except KeyError as ke:
                    print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en Digital. Operación abortada.")
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Excepción en digital {trade_pair}: {e}")

        attempt_trade(try_first)
        if not check and try_second:
            print(f"[WORKER {WORKER_PORT}] Falló {try_first}, intentando {try_second}...")
            attempt_trade(try_second)

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
                        # Leer directamente del diccionario asíncrono para evitar el while True bloqueante
                        order = iq_obj.get_async_order(oid)
                        if order and order.get("position-changed", {}) != {}:
                            msg = order["position-changed"].get("msg")
                            if msg and msg.get("status") == "closed":
                                if msg.get("close_reason") == "expired":
                                    profit = float(msg.get("close_profit", 0)) - float(msg.get("invest", 0))
                                elif msg.get("close_reason") == "default":
                                    profit = float(msg.get("pnl_realized", 0))
                    else:
                        # Para binaria, revisar el diccionario asíncrono v4
                        x = iq_obj.api.socket_option_closed.get(oid)
                        if x is not None:
                            msg = x.get('msg', {})
                            win = msg.get('win')
                            if win == 'equal':
                                profit = 0.0
                            elif win == 'loose':
                                profit = float(msg.get('sum', 0)) * -1.0
                            elif win == 'win':
                                profit = float(msg.get('win_amount', 0)) - float(msg.get('sum', 0))
                except Exception as e:
                    print(f"[WORKER] Reintentando resultado de {t_mode} {oid}: {e}")
                if profit is None:
                    time.sleep(3)

            if profit is None:
                # No se pudo determinar a tiempo: lo marcamos como cerrado neutro.
                print(f"[WORKER] Sin resultado para {t_mode} {oid} dentro del límite.")
                profit = 0.0

            status = "win" if profit > 0 else ("loss" if profit < 0 else "tie")
            # FALLA #1 FIX: guardar en RAM + disco para sobrevivir reinicios
            _persist_result(str(oid), {
                "status": "COMPLETED",
                "profit": round(profit, 2),
                "win": status == "win"
            })

        # FALLA #1 FIX: persistir el estado PENDING en disco también
        _persist_result(str(order_id), {"status": "PENDING"})
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
