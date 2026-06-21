import os
import time
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from iqoptionapi.stable_api import IQ_Option

app = Flask(__name__)
# Permitir CORS para que Vercel y Localtunnel no tengan problemas
CORS(app, resources={r"/*": {"origins": "*"}})

# Almacen de sesiones: { "email_accountType": iq_object }
sessions = {}

def get_iq_connection(email, password, account_type='demo'):
    # Crear una llave única para esta combinación de correo y tipo de cuenta
    session_key = f"{email}_{account_type.lower()}"
    target_mode = "PRACTICE" if account_type.lower() == 'demo' else "REAL"
    
    try:
        # Si ya existe la sesión y está conectada, la usamos
        if session_key in sessions:
            iq = sessions[session_key]
            if iq.check_connect():
                # Nos aseguramos que esté en el modo correcto (Real/Demo)
                iq.change_balance(target_mode)
                return iq, None
            else:
                # Si se desconectó, la removemos para crear una nueva
                del sessions[session_key]
        
        # Crear nueva conexión
        iq = IQ_Option(email, password)
        check, reason = iq.connect()
        
        if not check:
            return None, f"Error de conexión: {reason}"
            
        iq.change_balance(target_mode)
        
        # Esperar sincronización de saldo (vital para no mostrar $0 previos)
        time.sleep(2) 
        
        sessions[session_key] = iq
        return iq, None
    except Exception as e:
        return None, str(e)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ONLINE",
        "sessions_active": list(sessions.keys()),
        "server_time": time.time()
    })

@app.route('/connect', methods=['POST'])
def connect():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        acc_type = data.get('accountType', 'demo')
        
        iq, error = get_iq_connection(email, password, acc_type)
        if not iq:
            return jsonify({"success": False, "error": error}), 401
            
        return jsonify({
            "success": True, 
            "balance": iq.get_balance(),
            "account": email,
            "type": acc_type,
            "status": "connected"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        pair = data.get('pair', 'EURUSD')
        acc_type = data.get('accountType', 'demo')

        iq, error = get_iq_connection(email, password, acc_type)
        if not iq:
            return jsonify({"success": False, "error": "Sesión no disponible. Re-conecte."}), 401

        # Obtener velas actualizadas
        candles = iq.get_candles(pair, 60, 30, time.time())
        
        # Dirección basada en última vela
        direction = "NEUTRAL"
        if len(candles) > 1:
            last_close = candles[-1]['close']
            prev_close = candles[-2]['close']
            if last_close > prev_close: direction = "CALL"
            if last_close < prev_close: direction = "PUT"

        return jsonify({
            "success": True,
            "balance": iq.get_balance(),
            "direction": direction,
            "pair": pair,
            "account": email,
            "candles": candles[-20:] 
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Usar puerto 5000 por defecto
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
