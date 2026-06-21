import requests
import time
import json
import math
import sys
from datetime import datetime

# CONFIGURACIÓN MAESTRA V7
FIREBASE_URL = "https://botinvest-bfa58-default-rtdb.firebaseio.com"

# --- INTENTAR IMPORTAR IQ OPTION ---
try:
    from iqoptionapi.stable_api import IQ_Option
    HAS_IQ = True
except ImportError:
    HAS_IQ = False

def get_market_data(symbol):
    """Obtiene datos de Binance como fuente de respaldo."""
    try:
        binance_symbol = symbol.replace("-OTC", "").replace("/", "").replace("USD", "USDT")
        response = requests.get(f"https://api.binance.com/api/v3/ticker/price?symbol={binance_symbol}")
        return float(response.json()['price'])
    except:
        return 1.0850 # Fallback lineal

def update_firebase_balance(uid, balance, account_type):
    """Sincroniza el balance REAL con el Dashboard."""
    try:
        url = f"{FIREBASE_URL}/users/{uid}/trading_stats/{account_type.lower()}.json"
        payload = {
            "balance": float(balance),
            "lastSync": datetime.now().isoformat(),
            "status": "ACTIVE_BRIDGE"
        }
        requests.patch(url, data=json.dumps(payload))
        return True
    except:
        return False

def update_market_tick(pair, price):
    """Actualiza el feed de precios en vivo."""
    try:
        clean_pair = pair.replace("/", "").replace("-", "").strip()
        url = f"{FIREBASE_URL}/market/ticks/{clean_pair}.json"
        payload = {
            "price": price,
            "timestamp": int(time.time() * 1000),
            "rsi": 50 + (math.sin(time.time() / 20) * 20)
        }
        requests.patch(url, data=json.dumps(payload))
    except:
        pass

# --- MAIN ENGINE ---
print("--------------------------------------------------")
print("   NEUROTRADE V7 - MASTER BRIDGE (REAL SYNC)      ")
print("--------------------------------------------------")

if not HAS_IQ:
    print("[!] ADVERTENCIA: 'iqoptionapi' no está instalado.")
    print("    El saldo real no se sincronizará hasta que corras: pip install iqoptionapi")
    iq_email = None
else:
    iq_email = input("Introduce tu Email de IQ Option: ")
    iq_pass = input("Introduce tu Password: ")
    iq_type = input("Tipo de cuenta (PRACTICE/REAL): ").upper() or "PRACTICE"
    uid = input("Introduce tu UID de Firebase: ")

    print("\n[+] Conectando con IQ Option...")
    Iq = IQ_Option(iq_email, iq_pass)
    status, message = Iq.connect()
    
    if status:
        print("[OK] CONEXIÓN EXITOSA CON EL BROKER.")
        Iq.change_balance(iq_type)
    else:
        print(f"[ERROR] No se pudo conectar: {message}")
        sys.exit(1)

print("\n[STREAMING] Iniciando sincronización total...")

try:
    while True:
        # 1. Sincronizar Saldo Real (cada 10 segundos)
        if HAS_IQ and iq_email:
            real_balance = Iq.get_balance()
            update_firebase_balance(uid, real_balance, "demo" if iq_type == "PRACTICE" else "real")
            print(f" [SYNC] Balance {iq_type}: ${real_balance:.2f}", end="\r")

        # 2. Sincronizar Precios en Vivo
        for p in ["EURUSD-OTC", "BTCUSD"]:
            price = get_market_data(p)
            update_market_tick(p, price)
        
        time.sleep(1)
except KeyboardInterrupt:
    print("\nSistema desconectado.")
