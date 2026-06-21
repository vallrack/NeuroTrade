import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from iqoptionapi.stable_api import IQ_Option

app = Flask(__name__)
CORS(app)

# Almacén de sesiones para no reconectar en cada petición
sessions = {}

def get_iq_connection(email, password, account_type='demo'):
    """Obtiene o crea una sesión con el bróker y cambia el tipo de cuenta."""
    target_mode = "PRACTICE" if account_type.lower() == 'demo' else "REAL"
    
    if email in sessions:
        iq = sessions[email]
        if iq.check_connect():
            iq.change_balance(target_mode)
            return iq, None
            
    try:
        iq = IQ_Option(email, password)
        check, reason = iq.connect()
        if check:
            iq.change_balance(target_mode)
            sessions[email] = iq
            return iq, None
        else:
            return None, str(reason)
    except Exception as e:
        return None, str(e)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "V7_BRIDGE_ONLINE" if len(sessions) > 0 else "WAITING_CREDENTIALS",
        "mode": "SERVER_PRODUCTION_REAL",
        "iqoption_sdk": "LOADED"
    })

@app.route('/connect', methods=['POST'])
def connect():
    print("--- NUEVA SOLICITUD DE CONEXIÓN ---")
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        account_type = data.get('accountType', 'demo')
        
        print(f"Intento de conexión para: {email} en modo {account_type}")
        
        iq, error = get_iq_connection(email, password, account_type)
        if not iq:
            print(f"ERROR DE AUTENTICACIÓN: {error}")
            return jsonify({"success": False, "error": f"Auth Fail: {error}"}), 401
            
        balance = iq.get_balance()
        print(f"CONEXIÓN EXITOSA. Balance obtenido: {balance}")
        
        return jsonify({
            "success": True, 
            "balance": balance,
            "status": "connected"
        })
    except Exception as e:
        print(f"EXCEPCIÓN EN /CONNECT: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    # print(f"Analizando {request.json.get('pair')}...") # Comentado para no saturar logs
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        pair = data.get('pair', 'EURUSD-OTC')
        account_type = data.get('accountType', 'demo')
        
        if not email or not password:
            return jsonify({"success": False, "error": "Credenciales faltantes"}), 400

        iq, error = get_iq_connection(email, password, account_type)
        if not iq:
            return jsonify({"success": False, "error": f"Link Error: {error}"}), 401
            
        # Pedir velas de mercado real
        raw_candles = iq.get_candles(pair, 60, 40, time.time())
        if not raw_candles:
            return jsonify({"success": False, "error": "No hay respuesta de mercado"}), 500

        # Formatear para el motor de gráficos profesional
        chart_data = []
        for c in raw_candles:
            chart_data.append({
                "time": int(c['at']),
                "open": float(c['open']),
                "high": float(c['high']),
                "low": float(c['low']),
                "close": float(c['close'])
            })
        
        # Análisis de tendencia simple (Sin pandas para evitar errores)
        last_close = raw_candles[-1]['close']
        first_close = raw_candles[0]['close']
        trend = "CALL" if last_close > first_close else "PUT"
        
        # Obtener balance actual
        balance = iq.get_balance()
        
        return jsonify({
            "success": True,
            "status": "V7_BRIDGE_ONLINE",
            "pair": pair,
            "balance": balance,
            "direction": trend,
            "candles": chart_data,
            "logs": [
                {"timestamp": time.time(), "message": f"Telemetria oficial {pair} OK", "level": "success"},
                {"timestamp": time.time(), "message": f"Precio: {last_close} - Balance: {balance} {trend}", "level": "info"}
            ]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
