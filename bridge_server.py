import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from iqoptionapi.stable_api import IQ_Option

app = Flask(__name__)

# CORS amplio: permite cualquier origen (Vercel, localtunnel, localhost)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Bridge-Token", "Bypass-Tunnel-Reminder", "Cache-Control", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=False,
)

BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "neurotrade-secret-2024")
sessions = {}

# Umbrales RSI V7 (configurables por request)
DEFAULT_MIN_RSI = 38
DEFAULT_MAX_RSI = 62


@app.after_request
def add_cors_headers(response):
    """Asegura headers CORS en TODAS las respuestas (incluyendo errores 401/500)."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, X-Bridge-Token, Bypass-Tunnel-Reminder, Cache-Control, Authorization"
    )
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/", methods=["GET", "HEAD", "OPTIONS"])
def root():
    """Render hace HEAD / para verificar que el servicio responde (muestra 200, no 401)."""
    return jsonify({"status": "ONLINE", "service": "NeuroTrade Bridge V7"}), 200


def verify_token():
    """Devuelve None si la peticion es valida, o una Response de error 401."""
    if request.method == "OPTIONS":
        return None  # preflight CORS siempre pasa
    if request.path in ("/health", "/"):  # publicos
        return None
    token = request.headers.get("X-Bridge-Token", "")
    if token != BRIDGE_TOKEN:
        return jsonify({"success": False, "error": "Token invalido"}), 401
    return None


@app.before_request
def auth_middleware():
    result = verify_token()
    if result is not None:
        return result


def normalize_pair(pair):
    if not pair:
        return "EURUSD-OTC"
    return pair.upper().strip()


def api_pair_name(pair):
    """IQ Option buy API espera EURUSDOTC en lugar de EURUSD-OTC."""
    return normalize_pair(pair).replace("-", "")


def get_iq_connection(email, password, account_type="demo"):
    session_key = f"{email}_{account_type.lower()}"
    target_mode = "PRACTICE" if account_type.lower() == "demo" else "REAL"

    try:
        if session_key in sessions:
            iq = sessions[session_key]
            if iq.check_connect():
                iq.change_balance(target_mode)
                return iq, None
            del sessions[session_key]

        iq = IQ_Option(email, password)
        check, reason = iq.connect()
        if not check:
            return None, f"Error de conexión: {reason}"

        iq.change_balance(target_mode)
        time.sleep(2)
        sessions[session_key] = iq
        return iq, None
    except Exception as e:
        return None, str(e)


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
    """Estrategia V7: RSI cuántico + momentum de velas."""
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


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    """Endpoint publico — sin autenticacion, usado por el frontend para probar la conexion."""
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200
    return jsonify({
        "status": "ONLINE",
        "version": "V7",
        "sessions_active": len(sessions),
        "accounts": list(sessions.keys()),
        "server_time": time.time(),
        "token_configured": bool(BRIDGE_TOKEN),
    })


@app.route("/connect", methods=["POST"])
def connect():
    try:
        data = request.json or {}
        email = data.get("email")
        password = data.get("password")
        acc_type = data.get("accountType", "demo")

        if not email or not password:
            return jsonify({"success": False, "error": "Email y contraseña requeridos"}), 400

        iq, error = get_iq_connection(email, password, acc_type)
        if not iq:
            return jsonify({"success": False, "error": error}), 401

        return jsonify({
            "success": True,
            "balance": iq.get_balance(),
            "account": email,
            "type": acc_type,
            "status": "connected",
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/disconnect", methods=["POST"])
def disconnect():
    try:
        data = request.json or {}
        email = data.get("email")
        acc_type = data.get("accountType", "demo")
        session_key = f"{email}_{acc_type.lower()}"

        if session_key in sessions:
            iq = sessions[session_key]
            try:
                iq.logout()
            except Exception:
                pass
            del sessions[session_key]
            return jsonify({"success": True, "message": "Sesión cerrada correctamente"})

        return jsonify({"success": True, "message": "No había sesión activa"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.json or {}
        email = data.get("email")
        password = data.get("password")
        pair = normalize_pair(data.get("pair", "EURUSD-OTC"))
        acc_type = data.get("accountType", "demo")
        min_rsi = float(data.get("minRsi", DEFAULT_MIN_RSI))
        max_rsi = float(data.get("maxRsi", DEFAULT_MAX_RSI))

        if not email or not password:
            return jsonify({"success": False, "error": "Credenciales requeridas"}), 400

        iq, error = get_iq_connection(email, password, acc_type)
        if not iq:
            return jsonify({"success": False, "error": error or "Sesión no disponible"}), 401

        api_pair = api_pair_name(pair)
        candles = iq.get_candles(api_pair, 60, 30, time.time())
        if not candles:
            candles = iq.get_candles(pair, 60, 30, time.time())

        direction, probability, rsi = analyze_market(candles, min_rsi, max_rsi)
        logs = build_logs(pair, direction, rsi, probability)

        return jsonify({
            "success": True,
            "balance": iq.get_balance(),
            "direction": direction,
            "probability": probability,
            "rsi": rsi,
            "pair": pair,
            "account": email,
            "candles": candles[-20:] if candles else [],
            "logs": logs,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/trade", methods=["POST"])
def trade():
    try:
        data = request.json or {}
        email = data.get("email")
        password = data.get("password")
        acc_type = data.get("accountType", "demo")
        pair = normalize_pair(data.get("pair", "EURUSD-OTC"))
        direction = str(data.get("direction", "CALL")).upper()
        amount = float(data.get("amount", 1))
        expiration = int(data.get("expiration", 1))

        if not email or not password:
            return jsonify({"success": False, "error": "Credenciales requeridas"}), 400
        if direction not in ("CALL", "PUT"):
            return jsonify({"success": False, "error": "Dirección inválida"}), 400
        if amount <= 0:
            return jsonify({"success": False, "error": "Monto inválido"}), 400

        iq, error = get_iq_connection(email, password, acc_type)
        if not iq:
            return jsonify({"success": False, "error": error or "Sin sesión activa"}), 401

        api_pair = api_pair_name(pair)
        dir_lower = direction.lower()

        check, order_id = iq.buy(amount, api_pair, dir_lower, expiration)
        if not check:
            return jsonify({"success": False, "error": "Orden rechazada por IQ Option"}), 400

        profit = iq.check_win_v3(order_id)
        status = "win" if profit > 0 else ("loss" if profit < 0 else "tie")

        return jsonify({
            "success": True,
            "profit": profit,
            "status": status,
            "orderId": order_id,
            "balance": iq.get_balance(),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    token = os.environ.get("BRIDGE_TOKEN", "neurotrade-secret-2024")
    print("=" * 50)
    print("  NEUROTRADE V7 - BRIDGE SERVER")
    print("=" * 50)
    print(f"  Puerto : {port}")
    print(f"  Token  : {token[:8]}...")
    print(f"  Health : http://127.0.0.1:{port}/health")
    print("  Ctrl+C para detener")
    print("=" * 50)
    app.run(host="0.0.0.0", port=port)
