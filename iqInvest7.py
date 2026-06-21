import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import pandas as pd
import ta
import json
import customtkinter as ctk
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import os
import csv
import matplotlib.pyplot as plt
import pickle

# Importar nuevos módulos
from database_manager import TradingDB
from brokers import IQOptionBroker, PocketOptionBroker, QuotexBroker, DerivBroker, GenericBroker
from licensor import LicenseManager

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# ================== iqINVEST 7.0 - MULTI-PLATFORMA & DB ==================
# Mejoras principales:
# ✓ Arquitectura modular para múltiples brokers
# ✓ Base de datos SQLite para registro persistente (Compatibilidad EXE)
# ✓ Protección de capital (Stop Loss con margen de seguridad)
# ✓ Herramientas de diagnóstico integradas
# =========================================================================

def get_base_path():
    """Retorna la ruta base, ya sea ejecutando como script o como .exe congelado"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

class AdvancedTradingSuite(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Suite Multi-Broker Inteligente - iqInvest7")
        self.geometry("1480x880")
        
        # --- SISTEMA DE IDIOMAS ---
        self.current_lang = "ES"
        self.translations = {
            "ES": {
                "config_title": "⚙️ CONFIGURACIÓN V7",
                "btn_start": "🚀 INICIAR BOT",
                "btn_stop": "⏹️ DETENER",
                "tab_perf": "📊 Rendimiento",
                "tab_charts": "📈 Gráficos",
                "tab_history": "📋 Historial DB",
                "tab_logs": "📝 Eventos",
                "risk_mode": "Estrategia de Riesgo",
                "tg_notif": "Notificaciones Telegram",
                "news_filter": "Filtro Noticias (3 Toros)"
            },
            "EN": {
                "config_title": "⚙️ SETTINGS V7",
                "btn_start": "🚀 START BOT",
                "btn_stop": "⏹️ STOP",
                "tab_perf": "📊 Performance",
                "tab_charts": "📈 Charts",
                "tab_history": "📋 DB History",
                "tab_logs": "📝 Events",
                "risk_mode": "Risk Strategy",
                "tg_notif": "Telegram Notifications",
                "news_filter": "News Filter (3 Bulls)"
            }
        }

        # Ruta base para archivos persistentes
        self.base_path = get_base_path()
        
        # Gestor de DB (Pasamos la ruta base)
        self.db = TradingDB(self.base_path)
        
        # Variables de control
        self.broker = None
        self.is_running = False
        self.candle_size = 60
        self.is_news_pause = False
        self.news_events = [] # Lista de noticias de alto impacto
        self.active_orders = {}
        self.order_meta = {}
        
        self.trades_today = 0
        self.wins_today = 0
        self.losses_today = 0
        self.total_pnl_session = 0.0
        self.consecutive_losses_today = 0
        self.peak_pnl = 0.0
        
        self.initial_balance = 0.0
        self.current_balance = 0.0
        
        self.available_assets = ["EURUSD-OTC", "GBPUSD-OTC", "BTCUSD", "ETHUSD", "LTCUSD"]
        self.selected_assets = []
        self.asset_performance = {} 
        self.asset_viability = {}
        
        self.asset_checkboxes = {}
        self._init_asset_data()

        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.is_trained = False
        self.history_file = os.path.join(self.base_path, "trade_history_v2.csv") 
        self.config_file = os.path.join(self.base_path, "bot_config_v7.json")
        
        self._last_cleanup_hour = datetime.now().hour
        self.last_trade_minutes = {}

        self.setup_ui()
        self.load_config()
        # Entrena la IA en un hilo para no bloquear el arranque de la UI
        threading.Thread(target=self.load_and_train_ia, daemon=True).start()

        # Cargar stats iniciales de la DB
        stats = self.db.get_daily_stats()
        if stats:
            self.trades_today, self.wins_today, self.losses_today, self.total_pnl_session = stats
            self.after(500, self.update_dashboard_ui)

    def _init_asset_data(self):
        """Inicializa diccionarios de rendimiento para los activos disponibles"""
        for asset in self.available_assets:
            if asset not in self.asset_performance:
                self.asset_performance[asset] = {'wins': 0, 'losses': 0, 'pnl': 0.0, 'volatility': 0.0}
                self.asset_viability[asset] = 0.0

    def load_and_train_ia(self):
        """Entrena la IA usando datos históricos del CSV y la DB o carga un modelo existente"""
        model_path = os.path.join(self.base_path, "ai_brain.pkl")
        if os.path.exists(model_path):
            try:
                with open(model_path, "rb") as f:
                    self.model = pickle.load(f)
                self.is_trained = True
                self.log_message("🤖 IA: Memoria restaurada (Arranque ultra rápido)")
                return
            except Exception as e:
                self.log_message(f"⚠️ Error cargando memoria IA: {e}")
                
        try:
            data = []
            if os.path.exists(self.history_file):
                df_csv = pd.read_csv(self.history_file, names=['rsi', 'bb_b', 'macd', 'stoch', 'vol', 'won'])
                data.append(df_csv)
            
            history_db = self.db.get_history(limit=500)
            if history_db:
                db_rows = []
                for row in history_db:
                    won = 1 if row[6] == "Ganada" else 0
                    db_rows.append([row[9], row[10], row[11], row[12], row[13], won])
                df_db = pd.DataFrame(db_rows, columns=['rsi', 'bb_b', 'macd', 'stoch', 'vol', 'won'])
                data.append(df_db)

            if data:
                df = pd.concat(data)
                if len(df) >= 20:
                    X = df[['rsi', 'bb_b', 'macd', 'stoch', 'vol']].values
                    y = df['won'].values
                    self.model.fit(X, y)
                    self.is_trained = True
                    try:
                        with open(model_path, "wb") as f:
                            pickle.dump(self.model, f)
                    except: pass
                    self.log_message(f"🤖 IA: Modelo V2.1 entrenado con {len(df)} registros y memorizado")
                else:
                    self.log_message(f"🤖 IA: Datos insuficientes ({len(df)}/20)")
        except Exception as e:
            self.log_message(f"⚠️ Error IA: {e}")

    def ia_predict(self, features):
        if not self.is_trained: return True
        try:
            proba = self.model.predict_proba([features])[0][1]
            return proba >= 0.60
        except Exception: return True

    def save_config(self):
        config = {
            "email": self.email_entry.get(),
            "amount": self.amount_entry.get(),
            "duration": self.duration_entry.get(),
            "max_losses": self.max_losses_entry.get(),
            "max_trades": self.max_trades_entry.get(),
            "tp": self.tp_entry.get(),
            "sl": self.sl_entry.get(),
            "keep_min": self.keep_min_entry.get(),
            "rsi_buy": self.rsi_buy_entry.get(),
            "rsi_sell": self.rsi_sell_entry.get(),
            "risk_mode": self.risk_mode_selector.get(),
            "tg_token": self.tg_token_entry.get(),
            "tg_chatid": self.tg_chatid_entry.get(),
            "lang": self.current_lang,
            "sessions": [{"start": s.get(), "end": e.get()} for s, e, _ in getattr(self, 'session_widgets', [])],
            "platform": self.platform_selector.get(),
            "selected_assets": self.get_selected_assets(),
            "available_assets": self.available_assets
        }
        with open(self.config_file, 'w') as f:
            json.dump(config, f)

    def load_config(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                self.email_entry.insert(0, config.get("email", ""))
                self.amount_entry.insert(0, config.get("amount", "2000"))
                self.duration_entry.insert(0, config.get("duration", "1"))
                self.tp_entry.insert(0, config.get("tp", "50000"))
                self.sl_entry.insert(0, config.get("sl", "20000"))
                self.keep_min_entry.insert(0, config.get("keep_min", "10000"))
                self.platform_selector.set(config.get("platform", "IQ Option"))
                
                # Cargar sesiones dinámicas
                loaded_sessions = config.get("sessions", [{"start": "00", "end": "23"}])
                # Limpiar si ya había alguna (por el init de la UI)
                for widget in getattr(self, 'session_widgets', []):
                    widget[2].destroy()
                self.session_widgets = []
                for sess in loaded_sessions:
                    self.add_session_row(sess.get("start", "00"), sess.get("end", "23"))

                self.risk_mode_selector.set(config.get("risk_mode", "Fijo"))
                self.tg_token_entry.insert(0, config.get("tg_token", ""))
                self.tg_chatid_entry.insert(0, config.get("tg_chatid", ""))
                self.current_lang = config.get("lang", "ES")
                self.lang_switch.set(self.current_lang)
                
                # Cargar lista de activos guardados
                if "available_assets" in config:
                    self.available_assets = config["available_assets"]
                    self._init_asset_data()
                
                saved_assets = config.get("selected_assets", [])
                self.rebuild_asset_list(saved_assets)
                self.log_message("📁 Configuración cargada")
            except Exception as e:
                self.log_message(f"⚠️ Error config: {e}")

    def setup_ui(self):
        # --- PANEL LATERAL ---
        self.sidebar = ctk.CTkScrollableFrame(self, width=320, corner_radius=0)
        self.sidebar.pack(side="left", fill="y", padx=10, pady=10)
        
        self.title_lbl = ctk.CTkLabel(self.sidebar, text="⚙️ CONFIGURACIÓN V7", font=ctk.CTkFont(size=16, weight="bold"))
        self.title_lbl.pack(pady=15)
        
        self.platform_selector = ctk.CTkOptionMenu(self.sidebar, values=["IQ Option", "PocketOption", "Quotex", "Deriv"])
        self.platform_selector.set("IQ Option")
        self.platform_selector.pack(pady=10, fill="x", padx=15)

        self.email_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Correo / User", height=28)
        self.email_entry.pack(pady=2, fill="x", padx=15)
        self.pass_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Pass / Token", show="*", height=28)
        self.pass_entry.pack(pady=2, fill="x", padx=15)
        
        self.tp_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Take Profit (CO$)", height=28)
        self.tp_entry.pack(pady=1, fill="x", padx=15)
        self.sl_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Stop Loss (CO$)", height=28)
        self.sl_entry.pack(pady=1, fill="x", padx=15)
        self.keep_min_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Mantener Mínimo (Safe)", height=28)
        self.keep_min_entry.pack(pady=1, fill="x", padx=15)
        
        ctk.CTkLabel(self.sidebar, text="TP: Ganancia meta | SL: Pérdida máxima\nMin: Si el saldo baja de este monto, el bot para.", text_color="gray", font=("Helvetica", 9), justify="left").pack(pady=(0, 8), padx=15, anchor="w")

        self.amount_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Inversión (CO$)", height=28)
        self.amount_entry.pack(pady=2, fill="x", padx=15)
        self.duration_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Expiración (min)", height=28)
        self.duration_entry.pack(pady=2, fill="x", padx=15)

        # Sección de Activos Dinámicos
        self.add_asset_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.add_asset_frame.pack(fill="x", padx=15, pady=1) # Espaciado mínimo unificado
        self.new_asset_entry = ctk.CTkEntry(self.add_asset_frame, placeholder_text="Activo (Ej: BTCUSD)", height=25)
        self.new_asset_entry.pack(side="left", fill="x", expand=True, padx=(0, 5))
        self.btn_add_asset = ctk.CTkButton(self.add_asset_frame, text="+", width=25, height=25, command=self.add_custom_asset)
        self.btn_add_asset.pack(side="right")

        self.asset_list_container = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.asset_list_container.pack(fill="x", padx=15, pady=2)
        self.rebuild_asset_list()

        self.max_losses_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Max pérdidas cons.", height=28)
        self.max_losses_entry.insert(0, "3"); self.max_losses_entry.pack(pady=1, fill="x", padx=15)
        ctk.CTkLabel(self.sidebar, text="Detiene el bot tras esta cantidad de pérdidas seguidas.", text_color="gray", font=("Helvetica", 9), justify="left").pack(pady=(0, 8), padx=15, anchor="w")
        self.max_trades_entry = ctk.CTkEntry(self.sidebar, placeholder_text="Max trades diarios", height=28)
        self.max_trades_entry.insert(0, "20"); self.max_trades_entry.pack(pady=1, fill="x", padx=15)

        self.rsi_buy_entry = ctk.CTkEntry(self.sidebar, placeholder_text="RSI Buy (<=)", height=28); self.rsi_buy_entry.insert(0, "45")
        self.rsi_buy_entry.pack(pady=1, fill="x", padx=15)
        self.rsi_sell_entry = ctk.CTkEntry(self.sidebar, placeholder_text="RSI Sell (>=)", height=28); self.rsi_sell_entry.insert(0, "55")
        self.rsi_sell_entry.pack(pady=1, fill="x", padx=15)
        ctk.CTkLabel(self.sidebar, text="Umbrales RSI de sobreventa y sobrecompra.", text_color="gray", font=("Helvetica", 9), justify="left").pack(pady=(0, 8), padx=15, anchor="w")
        
        # Horarios Operativos Múltiples (Dinámicos)
        self.time_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.time_frame.pack(fill="x", padx=15, pady=5)
        
        header_frame = ctk.CTkFrame(self.time_frame, fg_color="transparent")
        header_frame.pack(fill="x")
        ctk.CTkLabel(header_frame, text="🕒 Horarios:").pack(side="left")
        btn_add_session = ctk.CTkButton(header_frame, text="+ Añadir", width=50, height=20, command=self.add_session_row)
        btn_add_session.pack(side="right")
        
        self.sessions_container = ctk.CTkFrame(self.time_frame, fg_color="transparent")
        self.sessions_container.pack(fill="x", pady=2)
        
        if not hasattr(self, 'session_widgets'):
            self.session_widgets = []
            
        ctk.CTkLabel(self.time_frame, text="Agrega franjas donde el bot puede operar.", text_color="gray", font=("Helvetica", 9), justify="left").pack(pady=(0, 5), anchor="w")

        self.env_switch = ctk.CTkSegmentedButton(self.sidebar, values=["DEMO", "REAL"]); self.env_switch.set("DEMO")  
        self.env_switch.pack(pady=10, fill="x", padx=15)

        # --- SECCIÓN AVANZADA (Telegram / Riesgo / Idioma) ---
        self.adv_frame = ctk.CTkFrame(self.sidebar, fg_color="gray15")
        self.adv_frame.pack(fill="x", padx=15, pady=2)
        
        self.risk_mode_selector = ctk.CTkOptionMenu(self.adv_frame, values=["Fijo", "Interés Compuesto", "Martingala"], height=25)
        self.risk_mode_selector.set("Fijo")
        self.risk_mode_selector.pack(pady=2, fill="x", padx=10)

        self.tg_label = ctk.CTkLabel(self.adv_frame, text="TELEGRAM (OPCIONAL)", font=("Helvetica", 10, "bold"), text_color="gray")
        self.tg_label.pack(pady=(5, 0))

        self.tg_token_entry = ctk.CTkEntry(self.adv_frame, placeholder_text="Token del Bot", height=22, font=("Helvetica", 10))
        self.tg_token_entry.pack(pady=1, fill="x", padx=10)
        self.tg_chatid_entry = ctk.CTkEntry(self.adv_frame, placeholder_text="Tu Chat ID", height=22, font=("Helvetica", 10))
        self.tg_chatid_entry.pack(pady=1, fill="x", padx=10)

        self.lang_switch = ctk.CTkSegmentedButton(self.sidebar, values=["ES", "EN"], command=self.change_language, height=25); self.lang_switch.set("ES")
        self.lang_switch.pack(pady=2, fill="x", padx=15)

        self.news_switch = ctk.CTkSwitch(self.sidebar, text="🚫 Filtro Noticias (3 Toros)", font=ctk.CTkFont(size=9))
        self.news_switch.select(); self.news_switch.pack(pady=2, padx=15, anchor="w")
        ctk.CTkLabel(self.sidebar, text="Pausa el bot ±15 mins cerca de una noticia.", text_color="gray", font=("Helvetica", 9), justify="left").pack(pady=(0, 8), padx=15, anchor="w")

        self.btn_connect = ctk.CTkButton(self.sidebar, text="🚀 INICIAR BOT", fg_color="#1e521e", command=self.start_bot)
        self.btn_connect.pack(pady=10, fill="x", padx=15)
        self.btn_stop = ctk.CTkButton(self.sidebar, text="⏹️ DETENER", fg_color="#a11f1f", command=self.stop_bot, state="disabled")
        self.btn_stop.pack(pady=5, fill="x", padx=15)

        # Botón de Diagnóstico
        self.btn_diagnose = ctk.CTkButton(self.sidebar, text="🔍 DIAGNÓSTICO", fg_color="#2b2b2b", command=self.run_diagnostic)
        self.btn_diagnose.pack(pady=10, fill="x", padx=15)

        self.status_lbl = ctk.CTkLabel(self.sidebar, text="Estado: Offline", text_color="gray", font=ctk.CTkFont(weight="bold"))
        self.status_lbl.pack(pady=10)

        # --- PANEL DERECHO ---
        self.tab_control = ctk.CTkTabview(self)
        self.tab_control.pack(side="right", fill="both", expand=True, padx=10, pady=10)
        self.tab_dashboard = self.tab_control.add("📊 Rendimiento")
        self.tab_charts = self.tab_control.add("📈 Gráficos")
        self.tab_history = self.tab_control.add("📋 Historial DB")
        self.tab_logs = self.tab_control.add("📝 Eventos")

        self.setup_dashboard()
        self.setup_charts()
        self.setup_history()
        self.setup_logs()

    def setup_dashboard(self):
        self.kpi_frame = ctk.CTkFrame(self.tab_dashboard); self.kpi_frame.pack(fill="x", padx=10, pady=10)
        self.kpi_total = ctk.CTkLabel(self.kpi_frame, text="Operaciones\n0", width=140, height=60, fg_color="#2b2b2b", corner_radius=8); self.kpi_total.grid(row=0, column=0, padx=10)
        self.kpi_win = ctk.CTkLabel(self.kpi_frame, text="Ganadas\n0", width=140, height=60, fg_color="#143714", text_color="green", corner_radius=8); self.kpi_win.grid(row=0, column=1, padx=10)
        self.kpi_loss = ctk.CTkLabel(self.kpi_frame, text="Perdidas\n0", width=140, height=60, fg_color="#3c1414", text_color="red", corner_radius=8); self.kpi_loss.grid(row=0, column=2, padx=10)
        self.kpi_pnl = ctk.CTkLabel(self.kpi_frame, text="PNL Hoy\nCO$ 0", width=180, height=60, fg_color="#1e1e1e", corner_radius=8); self.kpi_pnl.grid(row=0, column=3, padx=10)
        self.fig_perf = Figure(figsize=(12, 7), dpi=100); self.fig_perf.patch.set_facecolor('#1e1e1e'); self.ax_perf = self.fig_perf.add_subplot(111)
        self.ax_perf.set_facecolor('#1e1e1e')
        self.canvas_perf = FigureCanvasTkAgg(self.fig_perf, master=self.tab_dashboard)
        
        # Ocultar fondos blancos de Tkinter y mantener velocidad máxima
        canvas_widget = self.canvas_perf.get_tk_widget()
        canvas_widget.configure(bg='#1e1e1e', highlightthickness=0)
        canvas_widget.pack(expand=True, anchor="n", pady=10)
        canvas_widget.unbind("<Configure>")


    def setup_charts(self):
        # Solo creamos la figura y el canvas. Los subplots se crean dinámicamente.
        self.fig_market = Figure(figsize=(12, 8), dpi=100)
        self.fig_market.patch.set_facecolor('#1e1e1e')
        self.canvas_market = FigureCanvasTkAgg(self.fig_market, master=self.tab_charts)
        canvas_mkt_widget = self.canvas_market.get_tk_widget()
        canvas_mkt_widget.configure(bg='#1e1e1e', highlightthickness=0)
        canvas_mkt_widget.pack(fill="both", expand=True)
        
        # Dibujar placeholder inicial para que no se vea negro
        ax = self.fig_market.add_subplot(111)
        ax.set_facecolor('#1e1e1e')
        ax.text(0.5, 0.5, 'Inicia el bot para ver los graficos',
                ha='center', va='center', color='#555555', fontsize=14,
                transform=ax.transAxes)
        ax.axis('off')
        self.canvas_market.draw()


    def setup_history(self):
        # Panel superior de ranking
        self.ranking_frame = ctk.CTkFrame(self.tab_history, fg_color="#1e1e1e", height=50)
        self.ranking_frame.pack(fill="x", padx=10, pady=5)
        self.ranking_lbl = ctk.CTkLabel(self.ranking_frame, text="📊 ESCÁNER: Iniciando...", font=ctk.CTkFont(size=11, weight="bold"))
        self.ranking_lbl.pack(pady=8)
        
        # Tabla Profesional Ultrarrápida
        from tkinter import ttk
        style = ttk.Style()
        style.theme_use("default")
        style.configure("Treeview", background="#1e1e1e", foreground="white", rowheight=30, 
                        fieldbackground="#1e1e1e", borderwidth=0, font=("Helvetica", 10))
        style.map('Treeview', background=[('selected', '#2b2b2b')])
        style.configure("Treeview.Heading", background="#2b2b2b", foreground="white", 
                        relief="flat", font=("Helvetica", 10, "bold"))
        style.map("Treeview.Heading", background=[('active', '#3b3b3b')])

        columns = ("Hora", "Activo", "Dir", "Monto", "Resultado", "P&L")
        self.history_tree = ttk.Treeview(self.tab_history, columns=columns, show="headings", height=15)
        
        for col in columns:
            self.history_tree.heading(col, text=col)
            anchor = "e" if col in ["Monto", "P&L"] else "center"
            width = 130 if col == "Activo" else (110 if col == "Resultado" else 80)
            self.history_tree.column(col, width=width, anchor=anchor)

        self.history_tree.pack(fill="both", expand=True, padx=10, pady=5)
        
        # Colores corporativos para las filas
        self.history_tree.tag_configure('win', background='#143714', foreground='#00ffaa')
        self.history_tree.tag_configure('loss', background='#3c1414', foreground='#ff4444')
        self.history_tree.tag_configure('tie', background='#2b2b2b', foreground='white')

        self.refresh_history_ui()

    def setup_logs(self):
        self.log_text = ctk.CTkTextbox(self.tab_logs, fg_color="#1e1e1e"); self.log_text.pack(fill="both", expand=True, padx=5, pady=5)

    def log_message(self, msg):
        ts = datetime.now().strftime("%H:%M:%S")
        formatted_msg = f"[{ts}] {msg}"
        
        # Persistencia del Log para soporte técnico
        try:
            with open(os.path.join(self.base_path, "iqInvest.log"), "a", encoding="utf-8") as f:
                f.write(formatted_msg + "\n")
        except: pass

        def append_log():
            self.log_text.insert("end", formatted_msg + "\n")
            self.log_text.see("end")
            # Auto-limpieza preventiva: Si supera línea 500, borra la mitad superior
            if float(self.log_text.index('end-1c')) > 500.0:
                self.log_text.delete("1.0", "250.0")
        self.after(0, append_log)
        
        # Enviar a Telegram si está configurado
        if "ORDEN:" in msg or "RESULTADO:" in msg or "STOP" in msg:
            threading.Thread(target=self.send_telegram, args=(msg,), daemon=True).start()

    def send_telegram(self, msg):
        token = self.tg_token_entry.get().strip()
        chat_id = self.tg_chatid_entry.get().strip()
        if not token or not chat_id: return
        try:
            import requests
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {"chat_id": chat_id, "text": f"🤖 iqInvest7:\n{msg}"}
            requests.post(url, json=payload, timeout=5)
        except: pass

    def change_language(self, lang):
        self.current_lang = lang
        t = self.translations[lang]
        self.title_lbl.configure(text=t["config_title"])
        self.btn_connect.configure(text=t["btn_start"])
        self.btn_stop.configure(text=t["btn_stop"])
        self.tab_control._tab_buttons["📊 Rendimiento"].configure(text=t["tab_perf"])
        self.tab_control._tab_buttons["📈 Gráficos"].configure(text=t["tab_charts"])
        self.tab_control._tab_buttons["📋 Historial DB"].configure(text=t["tab_history"])
        self.tab_control._tab_buttons["📝 Eventos"].configure(text=t["tab_logs"])

    def update_news_calendar(self):
        """Descarga noticias de alto impacto (3 toros/estrellas)"""
        try:
            import requests
            import xml.etree.ElementTree as ET
            import pandas as pd
            
            self.log_message("📡 Actualizando calendario de noticias...")
            headers = {'User-Agent': 'Mozilla/5.0'}
            res = requests.get("https://nfs.faireconomy.media/ff_calendar_thisweek.xml", headers=headers, timeout=10)
            if res.status_code == 200:
                self.news_events = []
                root = ET.fromstring(res.content)
                for event in root.findall('event'):
                    impact = event.find('impact')
                    if impact is not None and impact.text == 'High':
                        date_str = event.find('date').text
                        time_str = event.find('time').text
                        try:
                            # 1. Parsear la hora de EE.UU (US/Eastern)
                            dt_est = pd.to_datetime(f"{date_str} {time_str}").tz_localize('US/Eastern')
                            # 2. Convertir a UTC puro
                            dt_utc = dt_est.tz_convert('UTC').tz_localize(None)
                            # 3. Calcular la diferencia del reloj del cliente vs UTC
                            local_offset = datetime.now() - datetime.utcnow()
                            # 4. Ajustar la noticia a la hora exacta del PC del usuario
                            dt_local = dt_utc + local_offset
                            
                            self.news_events.append(dt_local)
                        except: pass
                self.log_message(f"✅ Calendario de noticias sincronizado: {len(self.news_events)} eventos de alto impacto.")
            else:
                self.log_message("⚠️ No se pudo actualizar el calendario de noticias")
        except Exception as e:
            self.log_message(f"⚠️ Error actualizando noticias: {e}")

    def is_currently_news_time(self):
        """Verifica si estamos en ventana de noticia (+/- 15 min de un evento 3-bulls)"""
        if not self.news_switch.get(): return False
        now = datetime.now()
        for event_time in self.news_events:
            diff = abs((event_time - now).total_seconds() / 60)
            if diff <= 15: return True
        return False

    def refresh_history_ui(self):
        """Actualiza el historial con la tabla Treeview moderna"""
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)
            
        history = self.db.get_history(limit=50)
        
        for row in history:
            icon = "✅ Ganada" if row[6] == "Ganada" else ("🔵 Empate" if row[6] == "Empate" else "❌ Perdida")
            tag = "win" if row[6] == "Ganada" else ("tie" if row[6] == "Empate" else "loss")
            
            val_time = row[2]
            val_asset = row[3]
            val_dir = row[4].upper()
            val_amount = f"${row[5]:,.0f}"
            val_pnl = f"{row[7]:+,.0f}"
            
            self.history_tree.insert("", "end", values=(val_time, val_asset, val_dir, val_amount, icon, val_pnl), tags=(tag,))

    def add_custom_asset(self):
        asset = self.new_asset_entry.get().upper().strip()
        if asset and asset not in self.available_assets:
            self.available_assets.append(asset)
            self._init_asset_data()
            self.rebuild_asset_list()
            self.new_asset_entry.delete(0, 'end')
            self.save_config()

    def rebuild_asset_list(self, saved_checks=None):
        """Regenera los checkboxes de activos con botón de borrado"""
        for child in self.asset_list_container.winfo_children():
            child.destroy()
        
        self.asset_checkboxes = {}
        for asset in self.available_assets:
            is_selected = True if saved_checks and asset in saved_checks else False
            var = ctk.BooleanVar(value=is_selected)
            
            row_frame = ctk.CTkFrame(self.asset_list_container, fg_color="transparent")
            row_frame.pack(fill="x", pady=1)
            
            chk = ctk.CTkCheckBox(row_frame, text=asset, variable=var, font=ctk.CTkFont(size=10))
            chk.pack(side="left", anchor="w")
            
            btn_del = ctk.CTkButton(row_frame, text="X", width=20, height=20, fg_color="#a11f1f", hover_color="#ff4444", 
                                    font=ctk.CTkFont(size=10, weight="bold"),
                                    command=lambda a=asset: self.remove_asset(a))
            btn_del.pack(side="right", padx=5)
            
            self.asset_checkboxes[asset] = var

    def remove_asset(self, asset):
        if asset in self.available_assets:
            self.available_assets.remove(asset)
            if asset in self.selected_assets:
                self.selected_assets.remove(asset)
            self._init_asset_data()
            self.rebuild_asset_list(self.get_selected_assets())
            self.save_config()

    def add_session_row(self, start_val="00", end_val="23"):
        row = ctk.CTkFrame(self.sessions_container, fg_color="transparent")
        row.pack(fill="x", pady=2)
        
        cb_start = ctk.CTkComboBox(row, values=[f"{i:02d}" for i in range(24)], width=60)
        cb_start.set(start_val)
        cb_start.pack(side="left", padx=2)
        
        ctk.CTkLabel(row, text="a").pack(side="left", padx=2)
        
        cb_end = ctk.CTkComboBox(row, values=[f"{i:02d}" for i in range(24)], width=60)
        cb_end.set(end_val)
        cb_end.pack(side="left", padx=2)
        
        btn_del = ctk.CTkButton(row, text="X", width=20, height=20, fg_color="#a11f1f",
                                command=lambda r=row: self.remove_session_row(r))
        btn_del.pack(side="right", padx=2)
        
        self.session_widgets.append((cb_start, cb_end, row))
        
    def remove_session_row(self, row_frame):
        for widget_tuple in self.session_widgets:
            if widget_tuple[2] == row_frame:
                self.session_widgets.remove(widget_tuple)
                row_frame.destroy()
                break

    def get_selected_assets(self):
        """Retorna lista de activos marcados por el usuario"""
        return [asset for asset, var in self.asset_checkboxes.items() if var.get()]

    def start_bot(self):
        if self.is_running: return
        self.selected_assets = self.get_selected_assets()
        if not self.selected_assets: 
            self.log_message("⚠️ Selecciona al menos un activo")
            return
        
        # Limpiar caché de gráficos al iniciar
        self.market_data_cache = {}
        
        platform = self.platform_selector.get()
        try:
            if platform == "IQ Option": self.broker = IQOptionBroker()
            elif platform == "PocketOption": self.broker = PocketOptionBroker()
            elif platform == "Quotex": self.broker = QuotexBroker()
            elif platform == "Deriv": self.broker = DerivBroker()
            else: self.broker = GenericBroker()
        except Exception as e:
            self.log_message(str(e)); self.stop_bot(); return

        self.is_running = True
        self.consecutive_losses_today = 0
        self.peak_pnl = 0.0
        self.btn_connect.configure(state="disabled"); self.btn_stop.configure(state="normal")
        self.status_lbl.configure(text="Conectando...", text_color="orange")
        
        # Actualizar noticias al iniciar
        threading.Thread(target=self.update_news_calendar, daemon=True).start()
        
        threading.Thread(target=self.bot_core_loop, daemon=True).start()

    def stop_bot(self):
        self.is_running = False
        self.btn_connect.configure(state="normal"); self.btn_stop.configure(state="disabled")
        self.status_lbl.configure(text="Offline", text_color="gray")
        self.save_config()

    def bot_core_loop(self):
        from concurrent.futures import ThreadPoolExecutor
        email = self.email_entry.get().strip(); pw = self.pass_entry.get().strip()
        
        try:
            check, reason = self.broker.connect(email, pw)
            if not check: 
                self.log_message(f"❌ Conexión fallida: {reason}"); self.after(0, self.stop_bot); return
            
            mode = "REAL" if self.env_switch.get() == "REAL" else "PRACTICE"
            self.broker.change_balance(mode); self.initial_balance = self.broker.get_balance()
            self.current_balance = self.initial_balance
            self.log_message(f"✔️ Conectado a {self.platform_selector.get()} | Balance: {self.current_balance}")
            self.after(0, lambda: self.status_lbl.configure(text=f"Online ({mode})", text_color="green"))
            
            cycle_count = 0
            while self.is_running:
                if not self.broker.check_connect():
                    self.log_message("📡 Conexión perdida. Reconectando...")
                    self.broker.connect(email, pw); time.sleep(5); continue

                if not self.check_safety_limits(): 
                    time.sleep(5); continue

                safe_active = [a for a, var in self.asset_checkboxes.items() if var.get()]
                if not safe_active:
                    self.after(0, lambda: self.status_lbl.configure(text="⚠️ Selecciona activos", text_color="yellow"))
                    time.sleep(5); continue

                cycle_count += 1
                if cycle_count >= 10:
                    self.log_message(f"💓 Latido: Sistema estable. Escaneando {len(safe_active)} activos...")
                    cycle_count = 0

                assets_str = ", ".join(safe_active)
                self.after(0, lambda s=assets_str: self.status_lbl.configure(text=f"Analizando: {s}", text_color="cyan"))
                
                # Ejecución en paralelo (Anti-Ban con micro-pausas)
                with ThreadPoolExecutor(max_workers=min(len(safe_active), 5)) as executor:
                    for asset in safe_active:
                        time.sleep(0.5) # Micro-pausa escalonada para evitar bloqueos por Spam
                        executor.submit(self.analyze_single_asset, asset, safe_active)
                
                time.sleep(2)

        except Exception as e:
            self.log_message(f"❌ Error crítico Loop: {e}"); self.after(0, self.stop_bot)

    def analyze_single_asset(self, asset, active_list):
        try:
            if not self.is_running: return
            
            # Obtener velas crudas del broker (intervalo 60s, 100 velas)
            candles = self.broker.get_candles(asset, 60, 100)
            if not candles:
                self.log_message(f"⚠️ Sin datos para {asset}")
                return
            
            # Convertir a DataFrame enriquecido con indicadores
            df = self.prepare_dataframe(candles)
            if df is None or df.empty or len(df) < 20: return

            # Analizar estrategia
            self.analyze_and_trade(df, asset)
            
            # Guardar en caché y mandar a dibujar TODOS los gráficos activos
            self.market_data_cache[asset] = df
            display_dict = {a: self.market_data_cache[a] for a in active_list if a in self.market_data_cache}
            
            if display_dict:
                self.after(0, lambda d=display_dict: self.update_market_charts(d))
        except Exception as e:
            self.log_message(f"❌ Error en {asset}: {e}")

    def check_safety_limits(self):
        try:
            # 1. Filtro de Noticias
            if self.is_currently_news_time():
                self.after(0, lambda: self.status_lbl.configure(text="🚫 Pausa: NOTICIAS", text_color="red"))
                time.sleep(30)
                return False

            # 2. Check Horarios Múltiples con Cierre de Sesión Automatizado
            now = datetime.now()
            is_valid_time = False
            
            # Si no hay ninguna sesión configurada, se asume 24h
            if not getattr(self, 'session_widgets', []):
                is_valid_time = True
            else:
                for start_cb, end_cb, _ in self.session_widgets:
                    try:
                        s_start = int(start_cb.get())
                        s_end = int(end_cb.get())
                        if s_start <= now.hour <= s_end:
                            is_valid_time = True
                            break
                    except: pass
            
            if not is_valid_time:
                # Si estamos fuera de horario, verificamos si hay que cerrar la jornada
                if self.is_running:
                    reporte = (
                        f"🏁 JORNADA FINALIZADA AUTOMÁTICAMENTE\n"
                        f"------------------------------------\n"
                        f"💰 PNL Sesión: ${self.total_pnl_session:,.0f}\n"
                        f"✅ Ganadas: {self.wins_today}\n"
                        f"❌ Perdidas: {self.losses_today}\n"
                        f"📊 Efectividad: {(self.wins_today/self.trades_today*100) if self.trades_today > 0 else 0:.1f}%\n"
                        f"------------------------------------"
                    )
                    self.log_message(reporte)
                    # Forzamos la detención para que el usuario revise al día siguiente
                    self.after(0, self.stop_bot)
                
                self.after(0, lambda: self.status_lbl.configure(text=f"⏳ Esperando franja operativa...", text_color="orange"))
                time.sleep(60)
                return False

            tp = float(self.tp_entry.get()); sl = float(self.sl_entry.get())
            keep_min = float(self.keep_min_entry.get()); max_t = int(self.max_trades_entry.get())
            try: max_losses = int(self.max_losses_entry.get())
            except: max_losses = 3
        except: return True
        
        # Actualizar Pico Máximo
        if self.total_pnl_session > self.peak_pnl:
            self.peak_pnl = self.total_pnl_session
            
        # Trailing Stop: Si llevamos más del 30% del TP en ganancias, aseguramos el 65% de ese pico
        if self.peak_pnl > (tp * 0.3):
            trailing_stop = self.peak_pnl * 0.65
            if self.total_pnl_session <= trailing_stop and self.total_pnl_session > 0:
                self.log_message(f"🛡️ TRAILING STOP ACTIVADO: Asegurando ganancia (${self.total_pnl_session:.0f}) tras pico de ${self.peak_pnl:.0f}")
                self.after(0, self.stop_bot)
                return False

        if self.consecutive_losses_today >= max_losses:
            self.log_message(f"🛑 PROTECCIÓN: Límite de pérdidas consecutivas ({max_losses}) alcanzado.")
            self.after(0, self.stop_bot)
            return False

        if self.current_balance < keep_min:
            self.log_message(f"🛑 PROTECCIÓN: Balance ({self.current_balance:.0f}) < Mínimo."); self.after(0, self.stop_bot); return False
        if self.total_pnl_session >= tp: self.log_message(f"🎯 TP Alcanzado"); self.after(0, self.stop_bot); return False
        if self.total_pnl_session <= -sl: self.log_message(f"🛑 SL Alcanzado"); self.after(0, self.stop_bot); return False
        if self.trades_today >= max_t: self.log_message(f"⚠️ Max trades alcanzado"); self.after(0, self.stop_bot); return False
        return True

    def prepare_dataframe(self, candles):
        df = pd.DataFrame(candles)
        df[['close', 'open', 'min', 'max']] = df[['close', 'open', 'min', 'max']].astype(float)
        df['time'] = pd.to_datetime(df['from'], unit='s')
        df['rsi'] = ta.momentum.rsi(df['close'], window=14)
        try:
            adx_ind = ta.trend.ADXIndicator(df['max'], df['min'], df['close'], window=14)
            df['adx'] = adx_ind.adx()
            df['ema100'] = ta.trend.EMAIndicator(df['close'], window=100).ema_indicator()
        except Exception:
            df['adx'] = 0.0
            df['ema100'] = df['close']
        return df

    def analyze_and_trade(self, df, asset):
        if len(df) < 20: return
        bb = ta.volatility.BollingerBands(df["close"], window=20); macd = ta.trend.MACD(df["close"])
        stoch = ta.momentum.StochasticOscillator(df["max"], df["min"], df["close"])
        last = {
            'price': df['close'].iloc[-1], 'rsi': df['rsi'].iloc[-1], 'bb_h': bb.bollinger_hband().iloc[-1],
            'bb_l': bb.bollinger_lband().iloc[-1], 'macd': macd.macd().iloc[-1], 'macd_s': macd.macd_signal().iloc[-1],
            'stoch': stoch.stoch().iloc[-1], 'vol': df['close'].pct_change().std() * 100,
            'adx': df['adx'].iloc[-1] if 'adx' in df.columns else 0.0,
            'ema100': df['ema100'].iloc[-1] if 'ema100' in df.columns else df['close'].iloc[-1]
        }
        
        # Filtro de tendencia ADX: Evitar entradas en contra de tendencias fuertes (ADX < 30 indica mercado en rango)
        is_ranging = last['adx'] < 30.0
        
        # Filtro EMA 100: Si el precio está muy por debajo de la EMA, estamos en desplome, NO COMPRAR.
        above_ema = last['price'] >= last['ema100']

        bb_b = (last['price'] - last['bb_l']) / (last['bb_h'] - last['bb_l']) if (last['bb_h'] - last['bb_l']) != 0 else 0.5
        features = (last['rsi'], bb_b, last['macd'], last['stoch'], last['vol'])
        try: buy_thr = float(self.rsi_buy_entry.get()); sell_thr = float(self.rsi_sell_entry.get())
        except: buy_thr, sell_thr = 45, 55
        
        # Requerimos mercado en rango. Para comprar (Call), evitamos hacerlo en un desplome (requerimos estar sobre o cerca de la EMA100).
        if is_ranging and above_ema and sum([last['rsi'] <= buy_thr, last['price'] <= last['bb_l'], last['macd'] > last['macd_s'], last['stoch'] < 30]) >= 3:
            if self.ia_predict(features) and asset not in self.active_orders: self.execute_trade("call", asset, features)
        elif is_ranging and not above_ema and sum([last['rsi'] >= sell_thr, last['price'] >= last['bb_h'], last['macd'] < last['macd_s'], last['stoch'] > 70]) >= 3:
            if self.ia_predict(features) and asset not in self.active_orders: self.execute_trade("put", asset, features)

    def execute_trade(self, direction, asset, features):
        try: 
            base_amount = float(self.amount_entry.get())
            risk_mode = self.risk_mode_selector.get()
            
            # Cálculo de monto dinámico
            if risk_mode == "Interés Compuesto" and self.total_pnl_session > 0:
                amount = base_amount + (self.total_pnl_session * 0.1) # Reinvierte 10% de la ganancia
            elif risk_mode == "Martingala":
                # Buscar última operación de este activo
                last_trade = self.db.get_history(limit=5)
                amount = base_amount
                for t in last_trade:
                    if t[3] == asset:
                        if t[6] == "Perdida": amount = t[5] * 2.2 # Factor martingala
                        break
            else:
                amount = base_amount
            
            duration = int(self.duration_entry.get())
        except: return
        
        now_key = f"{asset}_{datetime.now().minute}"
        if now_key in self.last_trade_minutes: return
        self.last_trade_minutes[now_key] = True
        
        check, order_id = self.broker.buy(amount, asset, direction, duration)
        if check:
            self.active_orders[asset] = order_id; self.order_meta[order_id] = (features, asset, direction.upper(), amount)
            self.log_message(f"🚀 ORDEN: {direction.upper()} {asset} (${amount:,.0f})")
            threading.Thread(target=self.wait_for_result, args=(order_id, duration), daemon=True).start()

    def wait_for_result(self, order_id, duration):
        time.sleep((duration * 60) + 5)
        for _ in range(12): # Reintentar por 1 min
            res, pnl = self.broker.check_win(order_id)
            if res: self.register_trade_finish(order_id, res, pnl); return
            time.sleep(5)
        meta = self.order_meta.get(order_id)
        if meta: self.active_orders.pop(meta[1], None)

    def register_trade_finish(self, order_id, result_code, pnl):
        meta = self.order_meta.pop(order_id, None)
        if not meta:
            return
        features, asset, direction, amount = meta
        self.active_orders.pop(asset, None)
        res_str = "Ganada" if result_code == "win" else "Perdida"
        if result_code == "equal": res_str = "Empate"
        self.db.save_trade(order_id, asset, direction, amount, res_str, pnl, self.platform_selector.get(), features)
        self.trades_today += 1; 
        if res_str == "Ganada": 
            self.wins_today += 1
            self.consecutive_losses_today = 0
        elif res_str == "Perdida": 
            self.losses_today += 1
            self.consecutive_losses_today += 1
        self.total_pnl_session += pnl; self.current_balance = self.broker.get_balance()
        self.log_message(f"✅ RESULTADO: {res_str} | {asset} | P&L: {pnl:.0f}")
        self.after(0, self.update_dashboard_ui); self.after(0, self.refresh_history_ui)

    def update_dashboard_ui(self):
        self.kpi_total.configure(text=f"Operaciones\n{self.trades_today}")
        self.kpi_win.configure(text=f"Ganadas\n{self.wins_today}")
        self.kpi_loss.configure(text=f"Perdidas\n{self.losses_today}")
        color = "green" if self.total_pnl_session >= 0 else "red"
        self.kpi_pnl.configure(text=f"PNL Hoy\nCO$ {self.total_pnl_session:.0f}", text_color=color)
        
        self.ax_perf.clear()
        self.ax_perf.set_facecolor('#1e1e1e')
        self.ax_perf.grid(True, color='#333333', linestyle='--', alpha=0.3)
        
        history = self.db.get_history(limit=50)
        if history:
            curve = np.cumsum([0] + [r[7] for r in reversed(history)])
            x = np.arange(len(curve))
            self.ax_perf.axhline(0, color='white', linestyle='-', alpha=0.3, linewidth=1)
            
            # Línea de crecimiento
            line_color = '#00ffcc' if curve[-1] >= 0 else '#ff4444'
            self.ax_perf.plot(x, curve, color=line_color, linewidth=2, marker='o', markersize=3)
            
            # Sombreado condicional simplificado
            self.ax_perf.fill_between(x, curve, 0, where=(curve >= 0), color='#00ffaa', alpha=0.1, interpolate=True)
            self.ax_perf.fill_between(x, curve, 0, where=(curve < 0), color='#ff4444', alpha=0.1, interpolate=True)
            
            self.ax_perf.tick_params(colors='gray', labelsize=8)
            self.ax_perf.set_title("Rendimiento Dinámico de Sesión", color='white', fontsize=10)
        self.canvas_perf.draw_idle()

    def update_market_charts(self, df_dict):
        """Dibuja múltiples gráficos en rejilla dinámica"""
        if not df_dict: return

        # Limpiar figura y recrear subplots frescos
        self.fig_market.clear()
        
        count = len(df_dict)
        if count == 1:
            asset, df = list(df_dict.items())[0]
            if df is None or len(df) < 20: return
            ax_p = self.fig_market.add_subplot(211)
            ax_r = self.fig_market.add_subplot(212)
            self._draw_detailed_chart(ax_p, ax_r, df, asset)
        else:
            # Filtrar solo items con datos validos
            valid = [(a, d) for a, d in df_dict.items() if d is not None and len(d) >= 10]
            if not valid: return
            cols = 2
            rows = (len(valid) + 1) // 2
            for plot_idx, (asset, df) in enumerate(valid):
                ax = self.fig_market.add_subplot(rows, cols, plot_idx + 1)
                self._draw_compact_chart(ax, df, asset)
        
        self.fig_market.patch.set_facecolor('#1e1e1e')
        self.fig_market.tight_layout(pad=2.0)
        self.canvas_market.draw()

    def _draw_detailed_chart(self, ax_p, ax_r, df, asset):
        for ax in [ax_p, ax_r]:
            ax.set_facecolor('#1e1e1e')
            ax.grid(True, color='#333333', linestyle='--', alpha=0.3)
            ax.tick_params(colors='white', labelsize=8)
            ax.spines['bottom'].set_color('#444444')
            ax.spines['left'].set_color('#444444')

        idx = np.arange(len(df))
        try:
            bb = ta.volatility.BollingerBands(df["close"], window=20)
            ax_p.plot(idx, bb.bollinger_hband(), color='#00aaff', alpha=0.3)
            ax_p.plot(idx, bb.bollinger_lband(), color='#00aaff', alpha=0.3)
            ax_p.fill_between(idx, bb.bollinger_lband(), bb.bollinger_hband(), color='#00aaff', alpha=0.05)
        except: pass

        colors = ['#00ffaa' if c >= o else '#ff4444' for o, c in zip(df['open'], df['close'])]
        ax_p.vlines(idx, df['min'], df['max'], color=colors, linewidth=1)
        ax_p.bar(idx, df['close']-df['open'], bottom=df['open'], color=colors, width=0.6)
        ax_p.set_title(asset, color='#00ffaa', fontsize=11, weight='bold')
        
        if 'rsi' in df.columns:
            ax_r.plot(idx, df['rsi'], color='magenta', linewidth=1.5)
            ax_r.axhline(70, color='red', alpha=0.4, linestyle='--')
            ax_r.axhline(30, color='#00ff88', alpha=0.4, linestyle='--')
            ax_r.set_ylim(0, 100)
            ax_r.set_title("RSI", color='white', fontsize=9)

    def _draw_compact_chart(self, ax, df, asset):
        ax.set_facecolor('#1e1e1e')
        ax.grid(True, color='#333333', linestyle='--', alpha=0.2)
        ax.tick_params(colors='gray', labelsize=7)
        ax.spines['bottom'].set_color('#444444')
        ax.spines['left'].set_color('#444444')
        
        idx = np.arange(len(df))
        colors = ['#00ffaa' if c >= o else '#ff4444' for o, c in zip(df['open'], df['close'])]
        ax.vlines(idx, df['min'], df['max'], color=colors, linewidth=1)
        ax.bar(idx, df['close']-df['open'], bottom=df['open'], color=colors, width=0.7)
        ax.set_title(asset, color='cyan', fontsize=9, pad=4)

    def _scanner_loop(self):
        """(Anulado) Funcionalidad migrada al ciclo principal bot_core_loop para seguridad estructural"""
        pass

    def update_asset_scanner(self):
        """Actualiza el ranking usando solo datos superficiales para evitar Deadlocks en WebSockets por Activos cerrados."""
        if not self.broker or not self.is_running: return
        try:
            rankings = []
            for asset in self.available_assets:
                # Si el activo está seleccionado por el usuario sumamos la prioridad
                score = 100 if asset in self.selected_assets else 85
                rankings.append((asset, score))
            
            rankings.sort(key=lambda x: x[1], reverse=True)
            top_text = "📊 ACTIVOS PRIORIZADOS: " + " | ".join([f"{a}" for a, s in rankings[:3]])
            self.after(0, lambda: self.ranking_lbl.configure(text=top_text))
        except Exception:
            pass


    def run_diagnostic(self):
        self.log_message("🔍 Iniciando Diagnóstico de Sistema...")
        threading.Thread(target=self._diagnostic_process, daemon=True).start()

    def _diagnostic_process(self):
        # Test IA
        start = time.perf_counter()
        X = np.random.rand(100, 5); y = np.random.randint(0, 2, 100)
        temp_model = RandomForestClassifier(n_estimators=100); temp_model.fit(X, y)
        for _ in range(100): temp_model.predict([[0.5]*5])
        end = time.perf_counter()
        self.log_message(f"✅ Latencia IA: {(end-start)/100*1000:.2f} ms/predicción")
        
        # Test de Rutas
        self.log_message(f"📂 Ruta Base: {self.base_path}")
        self.log_message(f"📂 DB detectada: {os.path.exists(self.db.db_name)}")
        self.log_message(f"📊 Registros en DB: {len(self.db.get_history(limit=1000))}")
        
        # Test de Conectividad Simple (Opcional)
        if self.broker:
            self.log_message(f"📡 Broker actual: {type(self.broker).__name__}")
            self.log_message(f"📡 Estado Conexión: {self.broker.check_connect()}")

if __name__ == "__main__":
    # VALIDACIÓN DE LICENCIA (Versión Comercial)
    lic_manager = LicenseManager()
    is_valid, result = lic_manager.check_license()
    
    if not is_valid:
        lic_manager.show_license_error(result)
    else:
        # Si la licencia es válida, iniciamos el bot normalmente
        print(f"Bienvenido {result}. Licencia validada correctamente.")
        app = AdvancedTradingSuite()
        app.mainloop()
