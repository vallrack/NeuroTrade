import os
import sys
import time
import threading
import subprocess
import requests

# ─── INTERCEPCIÓN PARA PYINSTALLER (EJECUCIÓN DE WORKERS) ─────────────
if getattr(sys, 'frozen', False) and len(sys.argv) >= 3 and sys.argv[1] == "--worker":
    port_str = sys.argv[2]
    broker = "iqoption"
    if "--broker" in sys.argv:
        try:
            broker_idx = sys.argv.index("--broker")
            broker = sys.argv[broker_idx + 1]
        except:
            pass

    sys.argv = [sys.executable, port_str]
    port = int(port_str)
    
    if broker == "binance":
        import binance_worker as worker
        print(f"[BINANCE WORKER {port}] Iniciando desde ejecutable empacado...")
    else:
        import iq_worker as worker
        print(f"[IQ WORKER {port}] Iniciando desde ejecutable empacado...")
        
    worker.WORKER_PORT = port
    worker.app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
    sys.exit(0)
# ──────────────────────────────────────────────────────────────────────

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# CORS amplio
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Bridge-Token", "Bypass-Tunnel-Reminder", "Cache-Control", "Authorization", "Access-Control-Request-Private-Network"],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=False,
)

@app.after_request
def add_pna_headers(response):
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "neurotrade-secret-2024")

# Diccionario de workers. session_key -> {"port": int, "process": Popen}
# Bajo gunicorn con varios hilos, este estado es compartido: lo protegemos
# con un lock para evitar condiciones de carrera al crear workers / asignar puertos.
workers = {}
BASE_PORT = 50000
next_port = BASE_PORT
_worker_lock = threading.Lock()

def verify_token():
    if request.method == "OPTIONS":
        return None
    if request.path in ("/health", "/"):
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

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, X-Bridge-Token, Bypass-Tunnel-Reminder, Cache-Control, Authorization"
    )
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/", methods=["GET", "HEAD", "OPTIONS"])
def root():
    return jsonify({"status": "ONLINE", "service": "NeuroTrade Bridge V7 (Worker Manager)"}), 200

@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200
    
    # Limpiar workers muertos (bajo lock para no chocar con creaciones concurrentes)
    with _worker_lock:
        dead_keys = [k for k, v in workers.items() if v["process"].poll() is not None]
        for k in dead_keys:
            del workers[k]
        active = len(workers)
        accounts = list(workers.keys())

    return jsonify({
        "status": "ONLINE",
        "version": "V7 (Multi-User)",
        "workers_active": active,
        "accounts": accounts,
        "server_time": time.time(),
        "token_configured": bool(BRIDGE_TOKEN),
    })

def get_or_create_worker(email, acc_type, broker="iqoption"):
    global next_port
    session_key = f"{email}_{acc_type.lower()}_{broker.lower()}"

    # ── Sección crítica: comprobar/crear el worker y asignar puerto ──
    # Solo se mantiene el lock para mutar el estado compartido. El Popen es
    # instantáneo (no espera el arranque), así que el lock se libera rápido y
    # no bloquea la creación de workers de OTROS usuarios.
    with _worker_lock:
        worker = workers.get(session_key)
        if worker and worker["process"].poll() is None:
            return worker["port"], None
        if worker:  # proceso muerto: limpiar antes de recrear
            freed_port = worker["port"]
            del workers[session_key]
        else:
            freed_port = None

        port = freed_port if freed_port else next_port
        if not freed_port:
            next_port += 1

        print(f"[MANAGER] Creando Worker para {session_key} en el puerto {port}...")
        try:
            worker_script = f"{broker.lower()}_worker.py"
            if getattr(sys, 'frozen', False):
                # En un binario congelado, asume que los workers se manejarán a través del entry point principal
                proc = subprocess.Popen([sys.executable, "--worker", str(port), "--broker", broker])
            else:
                proc = subprocess.Popen([sys.executable, worker_script, str(port)])
        except Exception as e:
            return None, f"Fallo al crear subproceso: {str(e)}"
        workers[session_key] = {"port": port, "process": proc, "broker": broker}

    # ── Esperar el arranque FUERA del lock (otros usuarios siguen siendo atendidos) ──
    for _ in range(20):  # máx ~10s
        time.sleep(0.5)
        try:
            res = requests.get(f"http://127.0.0.1:{port}/ping", timeout=1)
            if res.status_code == 200:
                print(f"[MANAGER] Worker en puerto {port} está READY.")
                return port, None
        except requests.exceptions.RequestException:
            pass

    # No arrancó: limpiar bajo lock (solo si sigue siendo el mismo proceso)
    with _worker_lock:
        current = workers.get(session_key)
        if current and current["port"] == port:
            try:
                current["process"].kill()
            except Exception:
                pass
            del workers[session_key]
    return None, "El Worker de IQ Option tardó demasiado en iniciar."

def proxy_to_worker(path):
    data = request.json or {}
    email = data.get("email")
    acc_type = data.get("accountType", "demo")
    broker = data.get("brokerType", "iqoption")
    
    if not email:
        return jsonify({"success": False, "error": "Email/API Key requerido"}), 400
        
    port, err = get_or_create_worker(email, acc_type, broker)
    if err:
        return jsonify({"success": False, "error": err}), 500
        
    try:
        # /trade puede tardar (verificación de apertura + compra). /analyze debe
        # cerrarse antes de los 40s que espera el frontend, para liberar el hilo
        # del manager en vez de retenerlo en vano.
        if path == "/trade":
            timeout = 90
        elif path == "/analyze":
            timeout = 38
        elif path == "/connect":
            timeout = 60
        else:
            timeout = 30
        res = requests.post(f"http://127.0.0.1:{port}{path}", json=data, timeout=timeout)
        return jsonify(res.json()), res.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"success": False, "error": f"Fallo de comunicación con Worker: {str(e)}"}), 502

@app.route("/connect", methods=["POST"])
def connect():
    return proxy_to_worker("/connect")

@app.route("/actives", methods=["POST"])
def actives():
    return proxy_to_worker("/actives")

@app.route("/analyze", methods=["POST"])
def analyze():
    return proxy_to_worker("/analyze")

@app.route("/trade", methods=["POST"])
def trade():
    return proxy_to_worker("/trade")

@app.route("/trade_result", methods=["POST"])
def trade_result():
    return proxy_to_worker("/trade_result")

@app.route("/disconnect", methods=["POST"])
def disconnect():
    data = request.json or {}
    email = data.get("email")
    acc_type = data.get("accountType", "demo")
    if not email:
        return jsonify({"success": False, "error": "Email requerido"}), 400
        
    session_key = f"{email}_{acc_type.lower()}"
    with _worker_lock:
        worker = workers.pop(session_key, None)
    if worker:
        print(f"[MANAGER] Destruyendo Worker para {session_key}...")
        try:
            worker["process"].terminate()
        except Exception:
            pass
        return jsonify({"success": True, "message": "Sesión cerrada y Worker destruido."})

    return jsonify({"success": True, "message": "No había sesión activa"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    token = os.environ.get("BRIDGE_TOKEN", "neurotrade-secret-2024")
    print("=" * 60)
    print("  NEUROTRADE V7 - MANAGER DE SUBPROCESOS (MULTI-USER)")
    print("=" * 60)
    print(f"  Puerto : {port}")
    print(f"  Token  : {token[:8]}...")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port)
