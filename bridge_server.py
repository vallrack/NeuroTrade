
import os
import json
import time
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configuración de logs para ver errores en cPanel (archivo stderr.log)
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
# Permitimos peticiones desde cualquier origen (Vercel)
CORS(app, resources={r"/*": {"origins": "*"}})

BRIDGE_SECRET_KEY = os.environ.get("BRIDGE_SECRET_KEY", "quantum_v7_secure_key_123")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "V7_BRIDGE_ONLINE", "mode": "SERVER_PRODUCTION"})

@app.route('/connect', methods=['POST'])
def connect():
    try:
        app.logger.info("Recibida petición de conexión")
        data = request.json
        token = request.headers.get('X-Bridge-Token')
        
        if token != BRIDGE_SECRET_KEY:
            app.logger.warning(f"Token inválido: {token}")
            return jsonify({"success": False, "error": "ACCESO NO AUTORIZADO"}), 403

        # Simulamos éxito por ahora para probar túnel
        return jsonify({
            "success": True, 
            "balance": 5000.0,
            "status": "connected",
            "server": "NeuroTrade_Pro_Node"
        })
    except Exception as e:
        app.logger.error(f"Error en /connect: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/trade', methods=['POST'])
def trade():
    try:
        token = request.headers.get('X-Bridge-Token')
        if token != BRIDGE_SECRET_KEY:
            return jsonify({"success": False, "error": "FORBIDDEN"}), 403

        data = request.json
        amount = data.get('amount', 0)
        
        # Simulación de trading
        import random
        res = random.choice(['win', 'loss'])
        profit = amount * 0.87 if res == 'win' else -amount
        
        return jsonify({
            "success": True,
            "status": res,
            "profit": profit
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run()
