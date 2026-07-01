# Historial de Cambios: NeuroTrade V7

Este documento registra los cambios arquitectónicos, soluciones de bugs y refactorizaciones realizadas en NeuroTrade.

---

## 📅 [Última Actualización: 01-07-2026]

### 1. Corrección del Bug de Reportes Duplicados o Fallidos al Finalizar Sesión Definitiva
**Problema:** Al hacer clic en "Finalizar Sesión Definitiva", a veces el reporte no se generaba. Si el usuario usaba "Recuperar Reporte Perdido", se creaban reportes duplicados.
**Causa:** Una "condición de carrera" (race condition). El botón de desconexión disparaba el evento de cierre (`nt_manual_disconnect`) y acto seguido borraba los datos de la sesión marcándola como `disconnected`. El motor no alcanzaba a leer las operaciones antes de que los datos fueran limpiados.
**Solución:** 
- `broker/page.tsx`: Ahora espera activamente (hasta 15 segundos) un evento de confirmación `nt_manual_disconnect_done` antes de desconectar de Firestore.
- `bot-engine-provider.tsx`: Se añadió una verificación previa (`getDocs` con `where`) para asegurar que no se genere un reporte si ya existe uno para ese día/fase.

### 2. Sincronización del Botón de Emergencia (Kill Switch)
**Problema:** Al presionar el botón de "Aborto de Emergencia", el estado `bot_activo` cambiaba en base de datos pero el bot seguía operando en el navegador del usuario.
**Solución:**
- Se implementó un `useEffect` en `bot-engine-provider.tsx` que escucha en tiempo real la variable `bot_activo`.
- Si `bot_activo` cambia a `false`, se fuerza la parada inmediata del motor local (`setIsRunning(false)` y `setIsPreAnalyzing(false)`).

### 3. Consolidación de la Lógica de Fases del "Plan de 15 Días"
**Problema:** El componente `presets-manager.tsx` tenía copiada a mano toda la configuración de cada fase (riesgo, martingale, límites). Estaba desactualizada respecto a la configuración real (`plan-15-days.ts`). Por ejemplo, la Fase 1 manual permitía 2 pérdidas, mientras que la automática permitía 3.
**Solución:** 
- Se eliminó el código duplicado en `presets-manager.tsx`.
- Ahora todas las llamadas a presets utilizan `getPresetForDay()` asegurando una ÚNICA fuente de verdad.

### 4. Corrección en el Seguimiento de Días (`plan-tracker.tsx`)
**Problema:** Si el usuario abría la aplicación un día después pero no operaba, el sistema adelantaba el día del plan automáticamente.
**Solución:** 
- `plan-tracker.tsx` ahora solo actualiza la fecha de última conexión (`lastActiveDate`).
- El avance del "Día de Plan" fue delegado exclusivamente al momento en que el usuario genera un reporte con operaciones reales.

### 5. Sanitización de Datos Financieros (TypeScript Fixes)
**Problema:** Los datos devueltos por el puente de IQ Option podrían carecer de valores de beneficio (`profit`) o de `orderId` temporalmente debido a latencias, rompiendo los cálculos y generando errores visuales (NaN).
**Solución:** 
- Se asignaron valores de fallback por defecto (`profit ?? 0`) y cadenas vacías para evitar errores de renderizado en tiempo de ejecución.

### 6. Soporte de Análisis Cuántico con Fases (IA Army Prompt)
**Problema:** El análisis contextual (el cuadro de recomendaciones de la IA) no respetaba la fase en curso. Siempre recomendaba modo compuesto.
**Solución:**
- El evento de dispatch en `bot-engine-provider` ahora propaga la fase actual, cuenta, meta diaria y modo de gestión de capital.
- El modal fue reescrito para proteger el modo de la fase (no alterar Martingala si estamos en Fase 1) y solo ofrecer un reajuste de la meta diaria si el riesgo es bajo.

---

## 📅 [Iteración Previa] Arquitectura Multi-Usuario Aislada

### El Problema Original
Se detectó un comportamiento anómalo al conectar múltiples clientes al mismo servidor puente. Los saldos se mezclaban y las operaciones de un bot terminaban en la cuenta de otro usuario.

### Causa Raíz
La librería subyacente `iqoptionapi` fue diseñada para operar de forma "monolítica" (con un único usuario a la vez). Al inicializar múltiples conexiones, la última sesión sobreescribía la memoria RAM global.

### Solución Implementada: Aislamiento por Subprocesos (Worker Manager)
El servidor puente fue reconstruido:
- **`bridge_server.py`**: Actúa exclusivamente como un despachador y asignador de puertos HTTP.
- **`iq_worker.py`**: Cada usuario levanta un sub-proceso independiente de Flask en el sistema operativo (ej. puerto 50000). Al tener su propia memoria RAM aislada, es imposible que las sesiones se crucen.
- **Auto-Apagado**: Los subprocesos se cierran automáticamente tras 1 hora de inactividad para liberar RAM en Render.com.

---
*Este documento será la referencia técnica principal para futuros mantenimientos o auditorías de la arquitectura del bot.*
