from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import requests
import time
import json
from iqoptionapi.stable_api import IQ_Option

app = Flask(__name__)
CORS(app)

# Tu URL de Firebase Realtime Database
FIREBASE_URL = "https://botinvest-bfa58-default-rtdb.firebaseio.com"

# --- MOTOR DE PRECIOS EN VIVO ---
def market_data_engine():
    print("[FEED] Motor de precios iniciado (Binance Source).")
    while True:
            pairs_to_track = [
                "BTCUSDT", "ETHUSDT", "EURUSDT", "GBPUSDT", 
                "AUDUSDT", "NZDUSDT", "USDCAD", "USDCHF", "USDJPY",
                "SOLUSDT", "ADAUSDT", "XRPUSDT", "DOTUSDT", "DOGEUSDT",
                "BNBUSDT", "LINKUSDT"
            ]
            try:
                res = requests.get("https://api.binance.com/api/v3/ticker/price", timeout=2)
                data = res.json()
                
                prices = { item['symbol']: float(item['price']) for item in data if item['symbol'] in pairs_to_track }
                
                for symbol in pairs_to_track:
                    if symbol in prices:
                        price = prices[symbol]
                        pair_name = symbol.replace("USDT", "USD")
                        
                        if symbol in ["EURUSDT", "GBPUSDT"]:
                            pair_name += "OTC"
                        
                        requests.patch(f"{FIREBASE_URL}/market/ticks/{pair_name}.json", 
                            data=json.dumps({
                                "price": price, 
                                "timestamp": int(time.time()*1000),
                                "rsi": 50 
                            }))
            except Exception as e:
                pass
            time.sleep(1)

# Diccionario global para mantener las conexiones vivas por UID
iq_instances = {}

# --- ENDPOINT DE CONEXIÓN ---
@app.route('/connect', methods=['POST'])
def bridge_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    uid = data.get('uid')
    acc_type = data.get('accountType', 'demo').upper()
    
    if acc_type == 'DEMO': acc_type = 'PRACTICE'

    print(f"\n[BRIDGE] Solicitud recibida: {email} ({acc_type})")
    
    try:
        Iq = IQ_Option(email, password)
        status, message = Iq.connect()
        
        if status:
            Iq.change_balance(acc_type)
            real_balance = Iq.get_balance()
            
            # Guardamos la instancia para operaciones posteriores
            iq_instances[uid] = Iq
            
            # Sincronización con Firebase usando REST
            stats_doc = 'demo' if acc_type == 'PRACTICE' else 'real'
            db_url = f"{FIREBASE_URL}/users/{uid}/trading_stats/{stats_doc}.json"
            
            requests.patch(db_url, data=json.dumps({
                "balance": float(real_balance),
                "status": "ACTIVE_BRIDGE",
                "lastSync": str(time.ctime())
            }))
            
            print(f"[SUCCESS] {email} sincronizado. Balance: ${real_balance}")
            return jsonify({"success": True, "balance": real_balance})
        else:
            return jsonify({"success": False, "error": "Credenciales inválidas"}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- ENDPOINT HFT DE TRADING REAL ---
@app.route('/trade', methods=['POST'])
def bridge_trade():
    print("\n[BRIDGE] NUEVA ORDEN DE TRADING")
    data = request.json
    uid = data.get('uid')
    pair = data.get('pair', 'EURUSD-OTC')
    direction = data.get('direction', 'CALL').lower() # "call" o "put"
    amount = float(data.get('amount', 0))
    expiration = 1 # 1 minuto

    if uid not in iq_instances:
        return jsonify({"success": False, "error": "No hay un puente activo. Conecte de nuevo en el Dashboard."}), 401
        
    Iq = iq_instances[uid]
    
    # Adaptar pares OTC para API
    api_pair = pair
    if "-OTC" in pair:
        api_pair = pair.replace('-', '') # IQ API espera "EURUSDOTC"
        
    print(f"[EXEC] Operando ${amount} en {api_pair} ({direction.upper()})")
    
    try:
        check, id = Iq.buy(amount, api_pair, direction, expiration)
        
        if check:
            print(f"[WAIT] Orden {id} colocada. Esperando resultado {expiration} minuto(s)...")
            # Esto bloquea temporalmente para devolver el resultado final al frontend
            profit = Iq.check_win_v3(id)
            
            status = "win" if profit > 0 else "loss" if profit < 0 else "tie"
            print(f"[RESULT] Orden finalizada: {status.upper()} (Profit: {profit})")
            
            return jsonify({"success": True, "profit": profit, "status": status})
        else:
            print(f"[ERROR] API rechazó la orden: ID erróneo devuelto")
            return jsonify({"success": False, "error": "Fallo de ejecución o liquidez insuficiente"}), 400
    except Exception as e:
        print(f"[ERROR EXCEPCIÓN] {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Iniciar feed de precios
    threading.Thread(target=market_data_engine, daemon=True).start()
    
    print("--------------------------------------------------")
    print("   NEUROTRADE V7 - LOCAL DIRECT BRIDGE            ")
    print("   LISTO: Sin archivos JSON de seguridad          ")
    print("   ESCUNCHANDO DASHBOARD EN PUERTO 8888           ")
    print("--------------------------------------------------")
    app.run(port=8888)
