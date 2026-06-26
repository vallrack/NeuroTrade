# Mejoras Pendientes para el Algoritmo (Backlog)

Este documento contiene las ideas y mejoras sugeridas para llevar el algoritmo de trading (`iq_worker.py`) a un nivel institucional. Se pueden implementar gradualmente en el futuro.

## 1. Confluencia de Indicadores (Filtro de Falsas Señales)
Actualmente el bot depende mucho del **RSI** (sobrecompra/sobreventa). El problema del RSI es que en tendencias fuertes, el precio puede mantenerse sobrecomprado por mucho tiempo. 
- **Mejora:** Agregar **Bandas de Bollinger** o **MACD**. El bot solo debería abrir operación si el RSI marca entrada **Y** el precio rompe una Banda de Bollinger, creando una doble confirmación (confluencia).

## 2. Filtro de Tendencia Macro (EMA)
Operar en contra de la tendencia principal es la mayor causa de pérdidas en scalping/opciones.
- **Mejora:** Incorporar una **Media Móvil Exponencial (EMA) de 200 periodos**. La regla sería de oro: Si el precio actual está *por encima* de la EMA 200, el bot **solo** tiene permiso para buscar compras (CALL). Si está *por debajo*, **solo** busca ventas (PUT).

## 3. Filtro de Volatilidad (ATR)
A veces el mercado está "muerto" (velas minúsculas) y a veces muy errático. En ambos escenarios el RSI falla.
- **Mejora:** Integrar el indicador **ATR (Average True Range)**. El bot calcularía el tamaño promedio de las velas. Si el ATR es muy bajo (sin liquidez) o exageradamente alto (noticias fuertes), el bot pausa automáticamente las operaciones hasta que el mercado se normalice.

## 4. Gestión Dinámica de Riesgo (Money Management)
En lugar de invertir siempre un monto fijo ($10 o $50), el bot debería proteger la cuenta automáticamente.
- **Mejora:** Programar un **Riesgo Porcentual Fijo** (ej: invertir siempre el 2% del balance actual). Además, añadir un "Stop Loss" diario interno: si el bot pierde 3 veces seguidas o pierde un % límite de la cuenta, se "apaga" por el resto del día para evitar quemar la cuenta en un mal día del mercado.

## 5. Integración con Calendario Económico (Filtro de Noticias)
Los pares regulares de Forex presentan alta volatilidad errática durante anuncios económicos importantes (ej: NFP, tasas de la FED).
- **Mejora:** Conectar el bot a una API pública (como Investing.com o ForexFactory) para leer las noticias del día. El algoritmo sabría cuándo hay una "Noticia de 3 Toros" (Alto Impacto) y pausaría el trading 15 minutos antes y 15 minutos después del anuncio.
