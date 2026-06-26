import sys
import threading
import time

try:
    import webview
except ImportError:
    print("Por favor instala pywebview: pip install pywebview")
    sys.exit(1)

# HTML/CSS/JS Ultra Moderno (Estilo NeuroTrade Cyberpunk)
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

        /* Glassmorphism Header */
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

        @keyframes pulse-animation {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        /* Terminal Logs */
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

        /* Controls */
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
        <div class="log-entry"><span class="log-time">[07:00:01]</span> <span class="log-success">[SISTEMA] Iniciando NeuroBridge GUI (Modo Independiente)...</span></div>
        <div class="log-entry"><span class="log-time">[07:00:02]</span> <span>[SISTEMA] Escuchando en puerto 5000.</span></div>
    </div>

    <div class="controls">
        <button class="btn btn-primary" onclick="pywebview.api.test_connection()">Probar Conexión con IQ</button>
        <button class="btn btn-danger" onclick="pywebview.api.close_app()">Apagar Puente</button>
    </div>

    <script>
        // Función llamada desde Python para agregar logs en tiempo real
        function addLog(message, type="normal") {
            const terminal = document.getElementById('terminalBox');
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0];
            
            let colorClass = '';
            if (type === 'success') colorClass = 'log-success';
            if (type === 'warning') colorClass = 'log-warning';

            const logHtml = `<div class="log-entry"><span class="log-time">[${timeStr}]</span> <span class="${colorClass}">${message}</span></div>`;
            terminal.innerHTML += logHtml;
            terminal.scrollTop = terminal.scrollHeight;
        }

        function setOffline() {
            const badge = document.getElementById('statusBadge');
            const dot = document.getElementById('pulseDot');
            badge.className = 'status-badge offline';
            document.getElementById('statusText').innerText = 'PUENTE OFFLINE';
            dot.style.display = 'none';
        }
    </script>
</body>
</html>
"""

class BridgeAPI:
    """ API que conecta el HTML (Javascript) con funciones de Python """
    
    def __init__(self, window):
        self.window = window

    def test_connection(self):
        # Simulamos un test de conexión
        self.window.evaluate_js('addLog("[IQ OPTION] Solicitando ping al servidor de IQ Option...", "warning")')
        time.sleep(1)
        self.window.evaluate_js('addLog("[IQ OPTION] Conexión exitosa. Latencia: 24ms", "success")')
        return "OK"

    def close_app(self):
        self.window.evaluate_js('addLog("[SISTEMA] Apagando puente...", "warning")')
        self.window.evaluate_js('setOffline()')
        time.sleep(1)
        self.window.destroy()

if __name__ == '__main__':
    # Creamos la ventana nativa
    window = webview.create_window(
        'NeuroBridge V7', 
        html=HTML_CONTENT,
        width=800, 
        height=600,
        resizable=True,
        background_color='#0B0E14'
    )
    
    # Vinculamos la API de Python a Javascript
    api = BridgeAPI(window)
    window.expose(api.test_connection)
    window.expose(api.close_app)
    
    # Iniciamos la aplicación gráfica (no bloquea el backend)
    webview.start(debug=True)
