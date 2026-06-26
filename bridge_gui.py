import sys
import os
import threading
import time
import io

try:
    import webview
except ImportError:
    print("Por favor instala pywebview: pip install pywebview")
    sys.exit(1)

# Importamos el backend real del puente
import bridge_server

HTML_CONTENT = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuroBridge V7</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }

        body {
            background-color: #0B0E14;
            color: #E2E8F0;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100vh;
            overflow: hidden;
            padding: 20px;
        }

        .header {
            width: 100%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            padding: 20px;
            border-radius: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
        }

        .logo {
            font-size: 24px;
            font-weight: 800;
            background: linear-gradient(90deg, #3B82F6, #8B5CF6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .status-badge {
            background: rgba(16, 185, 129, 0.1);
            color: #10B981;
            padding: 8px 16px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 14px;
            border: 1px solid rgba(16, 185, 129, 0.2);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .status-badge.offline {
            background: rgba(239, 68, 68, 0.1);
            color: #EF4444;
            border-color: rgba(239, 68, 68, 0.2);
        }

        .pulse {
            width: 8px;
            height: 8px;
            background-color: #10B981;
            border-radius: 50%;
            box-shadow: 0 0 10px #10B981;
            animation: pulse-animation 1.5s infinite;
        }

        .status-badge.offline .pulse {
            display: none;
        }

        @keyframes pulse-animation {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .terminal {
            width: 100%;
            flex: 1;
            background: #000000;
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 16px;
            padding: 20px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            color: #3B82F6;
            overflow-y: auto;
            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
        }

        .log-entry { margin-bottom: 8px; }
        .log-time { color: #64748B; margin-right: 10px; }
        .log-success { color: #10B981; }
        .log-warning { color: #F59E0B; }
        .log-error { color: #EF4444; }

        .controls {
            width: 100%;
            display: flex;
            gap: 15px;
            margin-top: 20px;
        }

        .btn {
            flex: 1;
            padding: 15px;
            border-radius: 12px;
            border: none;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-primary {
            background: linear-gradient(90deg, #2563EB, #4F46E5);
            color: white;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
        }

        .btn-danger {
            background: rgba(239, 68, 68, 0.1);
            color: #EF4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.2);
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="logo">NeuroBridge V7</div>
        <div class="status-badge" id="statusBadge">
            <div class="pulse" id="pulseDot"></div>
            <span id="statusText">PUENTE ONLINE</span>
        </div>
    </div>

    <div class="terminal" id="terminalBox">
        <div class="log-entry"><span class="log-time">SISTEMA</span> <span class="log-success">Iniciando NeuroBridge GUI...</span></div>
    </div>

    <div class="controls">
        <button class="btn btn-primary" onclick="pywebview.api.test_connection()">Probar Conexión Local</button>
        <button class="btn btn-danger" id="toggleBtn" onclick="pywebview.api.toggle_connection()">Destruir Conexiones IQ</button>
    </div>

    <script>
        let isOnline = true;

        function addLog(message, type="normal") {
            const terminal = document.getElementById('terminalBox');
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            
            let colorClass = '';
            if (type === 'success') colorClass = 'log-success';
            if (type === 'warning') colorClass = 'log-warning';
            if (type === 'error') colorClass = 'log-error';

            const logHtml = `<div class="log-entry"><span class="log-time">[${timeStr}]</span> <span class="${colorClass}">${message}</span></div>`;
            terminal.innerHTML += logHtml;
            
            // Auto scroll
            if(terminal.scrollHeight - terminal.scrollTop < terminal.clientHeight + 100) {
                terminal.scrollTop = terminal.scrollHeight;
            }
        }

        function setStatus(online) {
            isOnline = online;
            const badge = document.getElementById('statusBadge');
            const toggleBtn = document.getElementById('toggleBtn');
            
            if (!online) {
                badge.className = 'status-badge offline';
                document.getElementById('statusText').innerText = 'WORKERS DETENIDOS';
                toggleBtn.innerText = 'Reiniciar Puente';
                toggleBtn.className = 'btn btn-primary'; // Cambia a azul para invitar a encender
            } else {
                badge.className = 'status-badge';
                document.getElementById('statusText').innerText = 'PUENTE ONLINE';
                toggleBtn.innerText = 'Destruir Conexiones IQ';
                toggleBtn.className = 'btn btn-danger';
            }
        }
    </script>
</body>
</html>
"""

class BridgeAPI:
    def __init__(self):
        self.window = None
        self.is_online = True

    def test_connection(self):
        self.window.evaluate_js('addLog("[SISTEMA] Solicitando ping al backend local...", "warning")')
        try:
            import requests
            port = int(os.environ.get("PORT", 5000))
            res = requests.get(f"http://127.0.0.1:{port}/health", timeout=2)
            if res.status_code == 200:
                data = res.json()
                self.window.evaluate_js(f'addLog("[SISTEMA] Conexión local exitosa. Workers de IQ activos: {data.get("workers_active")}", "success")')
            else:
                self.window.evaluate_js('addLog("[SISTEMA] Error de respuesta en servidor interno.", "error")')
        except Exception as e:
            self.window.evaluate_js(f'addLog("[SISTEMA] Error local: {str(e)}", "error")')
        return "OK"

    def toggle_connection(self):
        if self.is_online:
            # Apagar (Destruir workers)
            self.window.evaluate_js('addLog("[SISTEMA] Destruyendo todos los workers de IQ Option activos...", "error")')
            import bridge_server
            killed = 0
            with bridge_server._worker_lock:
                for session_key, worker in list(bridge_server.workers.items()):
                    try:
                        worker["process"].terminate()
                        killed += 1
                    except:
                        pass
                bridge_server.workers.clear()
            self.window.evaluate_js(f'addLog("[SISTEMA] {killed} workers finalizados. El puente está inactivo.", "warning")')
            self.window.evaluate_js('setStatus(false)')
            self.is_online = False
        else:
            # Encender (Solo cambiamos estado, el servidor Flask sigue corriendo)
            self.window.evaluate_js('addLog("[SISTEMA] Puente reiniciado. A la espera de conexiones desde el Dashboard...", "success")')
            self.window.evaluate_js('setStatus(true)')
            self.is_online = True
        return "OK"

class UILogger(io.StringIO):
    """ Redirige sys.stdout a la ventana de WebView """
    def __init__(self, api, original_stdout):
        super().__init__()
        self.api = api
        self.original_stdout = original_stdout

    def write(self, message):
        self.original_stdout.write(message)
        self.original_stdout.flush()
        
        msg = message.strip()
        if msg and self.api.window:
            safe_msg = msg.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'")
            
            type_str = "normal"
            if "error" in safe_msg.lower() or "fallo" in safe_msg.lower():
                type_str = "error"
            elif "exito" in safe_msg.lower() or "ready" in safe_msg.lower() or "online" in safe_msg.lower() or "health" in safe_msg.lower():
                type_str = "success"
            elif "warning" in safe_msg.lower() or "creando worker" in safe_msg.lower() or "destruyendo" in safe_msg.lower():
                type_str = "warning"
                
            try:
                self.api.window.evaluate_js(f'addLog("{safe_msg}", "{type_str}")')
            except Exception:
                pass

def run_flask_server():
    port = int(os.environ.get("PORT", 5000))
    print(f"[BRIDGE] Servidor Flask corriendo en puerto {port}...")
    import bridge_server
    bridge_server.app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Preparar API y ventana
    api = BridgeAPI()
    window = webview.create_window(
        'NeuroBridge V7 - Multi User', 
        html=HTML_CONTENT,
        width=900, 
        height=650,
        resizable=True,
        background_color='#0B0E14'
    )
    api.window = window
    window.expose(api.test_connection)
    window.expose(api.toggle_connection)

    # Redirigir stdout para que la consola se vea en el HTML
    original_stdout = sys.stdout
    sys.stdout = UILogger(api, original_stdout)

    # Iniciar Flask en segundo plano
    flask_thread = threading.Thread(target=run_flask_server, daemon=True)
    flask_thread.start()
    
    # Iniciar UI bloqueando el hilo principal
    webview.start(debug=False)
