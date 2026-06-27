# 📋 Mejoras Pendientes y Expansión a Futuro (Backlog de NeuroTrade)

Este documento unifica las ideas para mejorar la lógica actual del algoritmo (`iq_worker.py`) y la hoja de ruta para escalar la plataforma hacia una arquitectura Multi-Broker e institucional.

---

## 📈 FASE 1: Mejoras Lógicas del Algoritmo Actual

### 1. Confluencia de Indicadores (Filtro de Falsas Señales)
Actualmente el bot depende mucho del **RSI** (sobrecompra/sobreventa). El problema del RSI es que en tendencias fuertes, el precio puede mantenerse sobrecomprado por mucho tiempo. 
- **Mejora:** Agregar **Bandas de Bollinger** o **MACD**. El bot solo debería abrir operación si el RSI marca entrada **Y** el precio rompe una Banda de Bollinger, creando una doble confirmación (confluencia).

### 2. Filtro de Tendencia Macro (EMA)
Operar en contra de la tendencia principal es la mayor causa de pérdidas en scalping/opciones.
- **Mejora:** Incorporar una **Media Móvil Exponencial (EMA) de 200 periodos**. La regla sería de oro: Si el precio actual está *por encima* de la EMA 200, el bot **solo** tiene permiso para buscar compras (CALL). Si está *por debajo*, **solo** busca ventas (PUT).

### 3. Filtro de Volatilidad (ATR)
A veces el mercado está "muerto" (velas minúsculas) y a veces muy errático. En ambos escenarios el RSI falla.
- **Mejora:** Integrar el indicador **ATR (Average True Range)**. El bot calcularía el tamaño promedio de las velas. Si el ATR es muy bajo (sin liquidez) o exageradamente alto (noticias fuertes), el bot pausa automáticamente las operaciones hasta que el mercado se normalice.

### 4. Gestión Dinámica de Riesgo (Money Management)
En lugar de invertir siempre un monto fijo ($10 o $50), el bot debería proteger la cuenta automáticamente.
- **Mejora:** Programar un **Riesgo Porcentual Fijo** (ej: invertir siempre el 2% del balance actual). Además, añadir un "Stop Loss" diario interno: si el bot pierde 3 veces seguidas o pierde un % límite de la cuenta, se "apaga" por el resto del día para evitar quemar la cuenta en un mal día del mercado.

### 5. Integración con Calendario Económico (Filtro de Noticias)
Los pares regulares de Forex presentan alta volatilidad errática durante anuncios económicos importantes (ej: NFP, tasas de la FED).
- **Mejora:** Conectar el bot a una API pública (como Investing.com o ForexFactory) para leer las noticias del día. El algoritmo sabría cuándo hay una "Noticia de 3 Toros" (Alto Impacto) y pausaría el trading 15 minutos antes y 15 minutos después del anuncio.

---

## 🚀 FASE 2: Expansión de Mercados (Arquitectura Multi-Broker)

- `[ ]` **Desvincular Interfaz Gráfica (Frontend) de Pares Hardcodeados**:
  - Actualmente, el panel web (React) tiene listas fijas predeterminadas (ej. `['EURUSD-OTC', 'GBPUSD-OTC']`). Si el usuario intenta operar un par exótico o una acción (ej. `SNAP` o `USDJPY-OTC`), el sistema por defecto ignora la orden o entra en conflicto por no estar en la "lista blanca".
  - **Mejora:** Hacer que el frontend obtenga dinámicamente la lista de activos disponibles y abiertos directamente desde el backend (Broker) en tiempo real, eliminando las restricciones de interfaz.
- `[ ]` **Soporte para Binance (Criptomonedas)**: 
  - Integrar API de Binance mediante librerías oficiales (`ccxt` o `binance-python`).
  - Adaptar el `iq_worker.py` para tener un adaptador `binance_worker.py`.
- `[ ]` **Soporte para MetaTrader 4/5 (Forex Real)**:
  - Explorar APIs de conexión directa a MetaTrader para operar con brokers regulados de Forex.
- `[ ]` **Selector de Broker en UI**:
  - Modificar la vista de "Broker Link" para permitir al usuario seleccionar su motor de preferencia antes de arrancar el piloto automático.

---

## 🔬 Reporte de Investigación: APIs de Trading Institucional

### 1. Acciones, ETFs y Opciones
- **Alpaca Markets**: Construido "API-first", ideal para algoritmos. API REST y WebSockets impecable. Plan gratuito para datos en tiempo real y paper trading infinito. Usa la librería `alpaca-py`.
- **Interactive Brokers (IBKR)**: El gigante del trading algorítmico. Muy profesional y seguro pero su tecnología base requiere correr un software local permanente (IB Gateway). La comunidad usa la librería `ib_insync`.

### 2. Forex y CFDs
- **OANDA (v20)**: Muy respetado en Forex. API en entorno Sandbox (Demo) gratuita. No usa WebSockets sino HTTP Streaming. Librería: `oandapyV20`.
- **IG Group**: Broker masivo en Europa. Claves de API gratuitas. Usa tecnología Lightstreamer.

### 3. Fuentes de Datos (Market Data)
- **Yahoo Finance (`yfinance`)**: Ideal para descargar históricos diarios (Gratis).
- **Finnhub.io / Alpha Vantage**: Clave gratis con registro. Útiles para extraer fundamentales y datos de cripto.

---

## 🧩 Análisis de Integraciones del Ecosistema Alpaca
Tras analizar las integraciones de la "App Store" de Alpaca que me proporcionaste, estas son las herramientas más valiosas que se podrían utilizar para potenciar NeuroTrade en el futuro:

1. **TradingView**: 
   - **Utilidad para NeuroTrade:** En lugar de codificar indicadores (RSI, EMA, Bollinger) manualmente en Python (`iq_worker.py`), podríamos programar la estrategia visualmente en TradingView usando Pine Script. TradingView analizaría el mercado 24/7 y le enviaría un "Webhook" (una señal web) a nuestro servidor NeuroTrade, el cual solo se encargaría de enrutar la orden al broker instantáneamente.

2. **TradersPost / SignalStack**:
   - **Utilidad para NeuroTrade:** Son "puentes" ya construidos. Si decidimos usar alertas de TradingView, en lugar de programar nosotros el servidor que recibe los Webhooks en Python, podemos usar SignalStack para que intercepte la alerta de TradingView y la ejecute directamente en Alpaca en milisegundos.

3. **QuantConnect**:
   - **Utilidad para NeuroTrade:** Es el motor de backtesting y trading algorítmico más potente del mundo (LEAN Engine). Si en el futuro el motor actual de NeuroTrade necesita procesar gigabytes de datos, podríamos migrar la lógica del bot a QuantConnect, manteniendo nuestra interfaz gráfica actual.

4. **Alpaca CLI**:
   - **Utilidad para NeuroTrade:** Herramienta oficial de línea de comandos para que los desarrolladores puedan administrar la cuenta, ver balances y lanzar órdenes de prueba rápidamente sin tener que entrar a la interfaz web durante el desarrollo.

5. **TradeLab**:
   - **Utilidad para NeuroTrade:** Plataforma de construcción visual de estrategias ("como ChatGPT para bots"). Ideal si en el futuro quieres crear reglas complejas sin tener que codificar manualmente cada indicador matemático en Python.

6. **TraderFyles (Reportes de Impuestos)**:
   - **Utilidad para NeuroTrade:** Escalar a mercados reales (Acciones/Cripto en EE.UU. u otros países regulados) trae una responsabilidad legal que no existe en los brokers offshore de binarias: el pago de impuestos por cada transacción. Esta herramienta se conecta para automatizar la declaración fiscal de todas las operaciones del bot.

7. **Medved Trader**:
   - **Utilidad para NeuroTrade:** Si el Dashboard web que estamos construyendo en React algún día se queda corto, Medved es una terminal de escritorio ultra profesional que se conecta directamente a Alpaca. Podríamos usar su interfaz gráfica mientras nuestro bot trabaja por debajo.

8. **PortfolioShield (Gestión de Riesgo Externa)**:
   - **Utilidad para NeuroTrade:** Resuelve el punto #4 de nuestras mejoras pendientes (Gestión de Riesgo). En lugar de programar los límites de pérdida o bloqueos de cuenta en nuestro propio código, podríamos delegarle la protección del dinero a esta herramienta especializada.

9. **TradePulse (Order Flow Analytics)**:
   - **Utilidad para NeuroTrade:** En opciones binarias OTC no existe el "Libro de Órdenes" real. Al pasar a Alpaca o Cripto, esta integración nos daría acceso a la data del "Order Flow" (el flujo de dinero de las instituciones), permitiendo que el algoritmo opere basado en volumen real y no solo en el RSI.

---

## 💻 Fragmentos de Código Base (Pruebas de Concepto)

### 1. Alpaca Markets (alpaca-py)
```bash
pip install alpaca-py
```
```python
from alpaca.trading.client import TradingClient
# 'paper=True' asegura que estás operando con dinero ficticio
client = TradingClient("TU_API_KEY", "TU_SECRET_KEY", paper=True)
account = client.get_account()
print(f"Cuenta conectada. Balance: ${account.cash}")
```

### 2. OANDA (oandapyV20)
```bash
pip install oandapyV20
```
```python
import oandapyV20
import oandapyV20.endpoints.accounts as accounts
client = oandapyV20.API(access_token="TU_TOKEN", environment="practice")
r = accounts.AccountSummary(accountID="TU_ACCOUNT_ID")
client.request(r)
print(r.response)
```

### 3. Interactive Brokers (ib_insync)
```bash
pip install ib_insync
```
```python
from ib_insync import *
ib = IB()
# El puerto 7497 es para cuentas Demo/Paper en IB Gateway
ib.connect('127.0.0.1', 7497, clientId=1)
print(ib.accountValues())
ib.disconnect()
```

### 4. Yahoo Finance (yfinance)
```bash
pip install yfinance
```
```python
import yfinance as yf
ticker = yf.Ticker("AAPL")
print(ticker.history(period="5d")[['Open', 'High', 'Low', 'Close']])
```
