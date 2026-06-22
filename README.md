# NeuroTrade V7 - Centro de Comando

Sistema de trading HFT con comité de IA y puente Python hacia IQ Option.

## Arquitectura híbrida del puente

El **mismo archivo** `bridge_server.py` puede ejecutarse de dos formas. El usuario elige el modo en **Broker Link**:

```
                    ┌─────────────────────────────────────┐
  Vercel (web)      │         bridge_server.py            │
       │            │   (mismo código Python siempre)     │
       │            └──────────┬──────────────┬────────────┘
       │                       │              │
       └──── HTTP ─────────────┤              │
                               │              │
                    ┌──────────▼──────┐  ┌────▼──────────────┐
                    │  RENDER (nube)  │  │   MI PC (local)   │
                    │  24/7 en la web │  │ .exe o python     │
                    └────────┬────────┘  └────┬──────────────┘
                             │                │
                             └───────┬────────┘
                                     ▼
                              IQ Option API
```

### Modo 1 — RENDER (nube, recomendado)

- Despliega `bridge_server.py` en [Render.com](https://render.com)
- Funciona 24/7 sin tener el PC encendido
- En la app: **Broker Link → RENDER** → URL de Render

### Modo 2 — MI PC (local)

- Ejecuta en tu computadora:
  - **Recomendado:** `dist\NeuroTrade_Bridge.exe` (doble clic o `start-bridge.bat`)
  - **Alternativa:** `python bridge_server.py`
- Si usas la app en Vercel, expón el puerto con túnel:
  ```bash
  npx localtunnel --port 5000
  ```
- En la app: **Broker Link → MI PC** → pega la URL del túnel
- Si todo corre en local: usa `http://127.0.0.1:5000`

#### Crear el .exe (Windows)

```bash
build-bridge-exe.bat
```

Genera `dist\NeuroTrade_Bridge.exe` (~18 MB). Mismos endpoints que `bridge_server.py`.
Cierre el .exe antes de recompilar.

> La preferencia del usuario en Broker Link **tiene prioridad** sobre `NEXT_PUBLIC_BRIDGE_URL`. Así puedes cambiar entre Render y tu PC sin redeploy.

---

## Despliegue en Render (puente en la nube)

1. Conecta el repo a Render (o usa el `render.yaml` incluido).
2. **Build:** `pip install -r requirements.txt`
3. **Start:** `gunicorn bridge_server:app`
4. **Env:** `BRIDGE_TOKEN=neurotrade-secret-2024`
5. Copia la URL pública → en la app, modo **RENDER**.

## Despliegue en Vercel (frontend)

1. Conecta el repositorio a Vercel.
2. Configura las variables de `.env.example` (Firebase obligatorio).
3. `NEXT_PUBLIC_BRIDGE_URL` = URL de Render (**valor por defecto** del modo RENDER).
4. `NEXT_PUBLIC_BRIDGE_TOKEN` y `BRIDGE_TOKEN` = mismo valor que en Render.
5. Deploy.

## Desarrollo local completo

```bash
# Terminal 1 — Frontend
npm install && npm run dev          # http://localhost:9002

# Terminal 2 — Puente
pip install -r requirements.txt
python bridge_server.py             # http://localhost:5000
```

En Broker Link: modo **MI PC** → `http://localhost:5000`

## Verificar que funciona

1. Broker Link → **Probar conexión al puente** → debe decir PUENTE ONLINE
2. Activar vínculo con credenciales IQ Option → saldo real
3. Dashboard → badge **BRIDGE HFT ONLINE** + velas + RSI

---
*Desarrollado bajo el protocolo de ingeniería financiera NeuroTrade.*
