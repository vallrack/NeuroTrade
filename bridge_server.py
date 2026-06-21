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
    import pandas as pd
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        pair = data.get('pair', 'EURUSD-OTC')
        
        iq, error = get_iq_connection(email, password)
        if not iq:
            return jsonify({"success": False, "error": error}), 401
            
        # Obtenemos 50 velas para análisis técnico serio
        raw_candles = iq.get_candles(pair, 60, 50, time.time())
        if not raw_candles:
            return jsonify({"success": False, "error": "No se pudieron obtener velas"}), 500

        df = pd.DataFrame(raw_candles)
        
        # INDICADORES REALES (Como en iqInvest7)
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['ma20'] = df['close'].rolling(window=20).mean()
        df['std20'] = df['close'].rolling(window=20).std()
        df['upper'] = df['ma20'] + (df['std20'] * 2)
        df['lower'] = df['ma20'] - (df['std20'] * 2)

        last = df.iloc[-1]
        rsi_val = float(last['rsi'])
        
        # Lógica de decisión técnica pura
        tech_direction = 'NONE'
        if rsi_val < 30: tech_direction = 'CALL'
        elif rsi_val > 70: tech_direction = 'PUT'
        
        # Formatear velas para el gráfico (Frontend)
        chart_data = []
        for index, row in df.iterrows():
            chart_data.append({
                "time": int(row['at']),
                "open": float(row['open']),
                "high": float(row['high']),
                "low": float(row['low']),
                "close": float(row['close'])
            })

        logs = []
        logs.append({"timestamp": time.time(), "message": f"[SYSTEM] Escaneo de {pair} completado. RSI: {rsi_val:.2f}", "level": "info"})
        if tech_direction != 'NONE':
            logs.append({"timestamp": time.time(), "message": f"[SENTINEL] ¡ALERTA! Sobrecompra/Venta detectada. Sugerencia: {tech_direction}", "level": "warning"})
        
        return jsonify({
            "success": True,
            "pair": pair,
            "direction": tech_direction,
            "rsi": rsi_val,
            "candles": chart_data,
            "logs": logs
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
