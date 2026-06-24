# Historial de Cambios: Arquitectura Multi-Usuario (NeuroTrade)

## El Problema Original
Se detectó un comportamiento anómalo al conectar múltiples clientes (ej. cuenta de Vallrack y cuenta de Daniel) al mismo servidor puente (Render). El problema se manifestaba de la siguiente manera:
1. Los saldos se mostraban cruzados (la cuenta de Vallrack veía el saldo de Daniel).
2. Las operaciones ejecutadas por el bot de un usuario se enviaban a la cuenta del otro usuario.

### Causa Raíz
La librería subyacente `iqoptionapi` fue diseñada para operar con un único usuario a la vez. Almacena las credenciales de la sesión (`SSID`) y la identificación del balance (`balance_id`) en una variable compartida en memoria (`global_value.py`). Al inicializar múltiples conexiones dentro de un mismo servidor Flask (Render), la última sesión en conectarse sobreescribía los datos de las sesiones previas.

---

## Solución Implementada: Aislamiento por Subprocesos (Worker Manager)

Para solucionar el cruce de sesiones sin tener que contratar múltiples servidores en la nube, se re-arquitectó el backend en Python pasando de una estructura monolítica a un sistema de **Proxy de Subprocesos Aislados**.

### 1. `bridge_server.py` (El Gestor/Manager)
- Se eliminaron por completo las dependencias y las importaciones a `iqoptionapi`.
- Ahora actúa exclusivamente como un enrutador inteligente y despachador.
- **Flujo:** Cuando un usuario realiza una solicitud (ej. `/connect` o `/analyze`), el Gestor identifica el correo y verifica si existe un "Subproceso" activo para ese usuario.
  - Si **no existe**, asigna un puerto local (ej. 50000) y lanza un nuevo subproceso del sistema operativo.
  - Si **existe**, actúa como un Proxy inverso y reenvía el JSON mediante HTTP hacia el puerto asignado.

### 2. `iq_worker.py` (El Trabajador/Worker)
- Es un micro-servidor interno (Flask) que recibe solicitudes en un puerto específico (ej. `127.0.0.1:50000`).
- **Aislamiento Total:** Al ser un programa de Python independiente levantado por el SO, posee su propio espacio de memoria RAM. Por tanto, su propia instancia de `iqoptionapi` y sus propias variables globales (`global_value`).
- **Eficiencia:** Para evitar exceder la memoria RAM del plan gratuito de Render (512 MB), el Worker tiene un hilo supervisor que contabiliza la inactividad. Si el usuario no realiza ninguna petición en **1 hora**, el proceso ejecuta `os._exit(0)` y libera la memoria RAM.

### 3. Modificaciones en el Frontend (`bridge.ts` y `bot-engine-provider.tsx`)
- **Limpieza de errores:** Se corrigió un error visual por el cual los fallos HTTP (como un 401 de sesión desconectada) retornaban su estructura de JSON crudo (`{"error": "...", "success": false}`) directo a la interfaz.
- **Prevención de colapsos:** Se actualizó `bridgeAnalyze` en `bridge.ts` para que, en caso de fallo, retorne un objeto indicando `success: false` en lugar de lanzar una excepción (throw) y romper el ciclo principal de la máquina del bot. Esto permite reconexiones más elegantes.

---

## Observaciones Futuras
1. **Límites de RAM en Render:** Un subproceso consume aproximadamente 30-45 MB de RAM. Con 512 MB disponibles, el límite teórico es de 10-15 bots operando **simultáneamente**. Si crece tu base de usuarios en línea simultáneos, valora escalar el servidor o implementar un balanceador.
2. **Puertos Asignados:** Los puertos se incrementan desde el `50000`. En servidores Linux/Unix en la nube no supone problema, pero si requiriera reiniciar, el `bridge_server.py` se reinicia perdiendo el estado actual en memoria y forzando a los usuarios a re-conectar (comportamiento esperado).
