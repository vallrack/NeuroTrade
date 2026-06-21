import sys
import os
import time

# CAPTURA DE ERRORES
sys.stderr = open('/home/dprogram/bridge/python_errors.log', 'w')
sys.stdout = sys.stderr

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    from iqoptionapi.stable_api import IQ_Option
except ImportError as e:
    print(f"Error importando librerias: {e}")
    sys.exit(1)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Bridge-Token, Authorization'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Bridge-Token, Authorization'
    return response, 200

BRIDGE_SECRET_KEY = os.environ.get("BRIDGE_SECRET_KEY", "quantum_v7_secure_key_123")

# Instancia global del bróker para reutilizar la sesión
iq_instance = None

def get_iq_connection(email, password):
    """Crea o reutiliza una conexión con IQ Option."""
    global iq_instance
    try:
        iq = IQ_Option(email, password)
        check, reason = iq.connect()
        if check:
            iq_instance = iq
            return iq, None
        else:
            return None, f"Fallo de autenticacion: {reason}"
    except Exception as e:
        return None, str(e)

@app.route('/health', methods=['GET'])
def health():
    status = "V7_BRIDGE_ONLINE" if iq_instance else "WAITING_CREDENTIALS"
    return jsonify({
        "status": status,
        "mode": "SERVER_PRODUCTION_REAL",
        "iqoption_sdk": "LOADED"
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    import time
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        pair = data.get('pair', 'EURUSD-OTC')
        
        if not email or not password:
            return jsonify({"success": False, "error": "Faltan credenciales"}), 400

        # Conexión directa
        iq, error = get_iq_connection(email, password)
        if not iq:
            return jsonify({"success": False, "error": f"Error de conexión: {error}"}), 401
            
        # Pedir velas (Ligero: 30 velas)
        raw_candles = iq.get_candles(pair, 60, 30, time.time())
        if not raw_candles:
            return jsonify({"success": False, "error": "No hay datos del mercado"}), 500

        # Formateo ultra-simple para el gráfico
        chart_data = []
        for c in raw_candles:
            chart_data.append({
                "time": int(c['at']),
                "open": float(c['open']),
                "high": float(c['high']),
                "low": float(c['low']),
                "close": float(c['close'])
            })
        
        # Decisiones simples para evitar errores de librerías
        last_close = raw_candles[-1]['close']
        prev_close = raw_candles[-2]['close'] if len(raw_candles) > 1 else last_close
        direction = 'CALL' if last_close > prev_close else 'PUT'

        return jsonify({
            "success": True,
            "status": "V7_BRIDGE_ONLINE",
            "pair": pair,
            "direction": direction,
            "candles": chart_data,
            "logs": [
                {"timestamp": time.time(), "message": f"Conexión exitosa a IQ Option ({pair})", "level": "success"},
                {"timestamp": time.time(), "message": f"Precio actual: {last_close}", "level": "info"}
            ]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/connect', methods=['POST'])
def connect():
    try:
        token = request.headers.get('X-Bridge-Token')
        if token != BRIDGE_SECRET_KEY:
            return jsonify({"success": False, "error": "TOKEN_INVALIDO"}), 403

        data = request.json
        email = data.get('email')
        password = data.get('password')
        account_type = data.get('accountType', 'demo').upper()

        if not email or not password:
            return jsonify({"success": False, "error": "CREDENCIALES_FALTANTES"}), 400

        iq, error = get_iq_connection(email, password)
        if not iq:
            return jsonify({"success": False, "error": error}), 401

        # Cambiar al tipo de cuenta correcto
        if account_type == 'REAL':
            iq.change_balance('REAL')
        else:
            iq.change_balance('PRACTICE')

        # Esperar un momento para que el saldo se actualice
        time.sleep(1)

        balance = iq.get_balance()

        return jsonify({
            "success": True,
            "balance": float(balance),
            "status": "connected",
            "accountType": account_type,
            "server": "NeuroTrade_V7_IQOption_Bridge"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trade', methods=['POST'])
def trade():
    try:
        token = request.headers.get('X-Bridge-Token')
        if token != BRIDGE_SECRET_KEY:
            return jsonify({"success": False, "error": "FORBIDDEN"}), 403

        data = request.json
        email = data.get('email')
        password = data.get('password')
        pair = data.get('pair', 'EURUSD-OTC')
        direction = data.get('direction', 'call').lower()
        amount = float(data.get('amount', 1))
        duration = int(data.get('duration', 1))
        account_type = data.get('accountType', 'demo').upper()

        iq, error = get_iq_connection(email, password)
        if not iq:
            return jsonify({"success": False, "error": error}), 401

        if account_type == 'REAL':
            iq.change_balance('REAL')
        else:
            iq.change_balance('PRACTICE')

        # Ejecutar la operacion binaria
        status, id = iq.buy(amount, pair, direction, duration)

        if not status:
            return jsonify({"success": False, "error": "ERROR_AL_COMPRAR"}), 500

        # Esperar resultado
        time.sleep(duration * 60 + 5)
        result = iq.check_win_v3(id)

        profit = float(result) if result else -amount
        status_str = 'win' if profit > 0 else 'loss'

        return jsonify({
            "success": True,
            "status": status_str,
            "profit": profit,
            "trade_id": str(id)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run()
