import os
import time
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from iqoptionapi.stable_api import IQ_Option

app = Flask(__name__)
CORS(app)

# Almacen de sesiones
sessions = {}

def get_iq_connection(email, password, account_type='demo'):
    target_mode = "PRACTICE" if account_type.lower() == 'demo' else "REAL"
    try:
        if email in sessions:
            iq = sessions[email]
            if iq.check_connect():
                iq.change_balance(target_mode)
                return iq, None
        
        iq = IQ_Option(email, password)
        check, reason = iq.connect()
        
        iq.change_balance(target_mode)
        
        # Esperar hasta 3 segundos a que el saldo se sincronice
        for _ in range(3):
            balance = iq.get_balance()
            if balance is not None and balance > 0:
                break
            time.sleep(1)

        sessions[email] = iq
        return iq, None
    except Exception as e:
        return None, str(e)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ONLINE",
        "sessions_active": len(sessions),
        "sdk": "READY"
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
            return jsonify({"success": False, "error": f"Login Fail: {error}"}), 401
            
        return jsonify({
            "success": True, 
            "balance": iq.get_balance(),
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
            return jsonify({"success": False, "error": "Session lost"}), 401

        # Obtener velas (OHLC)
        candles = iq.get_candles(pair, 60, 30, time.time())
        
        # Analisis simple de tendencia (Sin PANDAS)
        if len(candles) > 1:
            last_close = candles[-1]['close']
            prev_close = candles[-2]['close']
            direction = "CALL" if last_close > prev_close else "PUT"
        else:
            direction = "NEUTRAL"

        return jsonify({
            "success": True,
            "balance": iq.get_balance(),
            "direction": direction,
            "pair": pair,
            "candles": candles[-20:] # Ultimas 20 para el grafico
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
