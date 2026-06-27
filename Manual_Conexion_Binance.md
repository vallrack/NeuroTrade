# Manual de Conexión a Binance - NeuroTrade V7

¡Bienvenido a NeuroTrade V7! Este documento te guiará paso a paso para conectar correctamente el motor de inteligencia artificial de NeuroTrade con tu cuenta de Binance, ya sea para practicar con dinero virtual (DEMO) o para operar con tu capital real (REAL).

---

## 1. Conceptos Muy Importantes

1. **El Modo "MI PC" es OBLIGATORIO para Binance:** 
   Binance prohíbe el acceso desde servidores ubicados en Estados Unidos. La nube gratuita donde se hospeda el panel web de NeuroTrade está en EE.UU., por lo que si intentas conectar Binance desde la nube (Render), Binance bloqueará tu conexión. 
   **Solución:** Siempre debes mantener abierto en tu computadora el programa `NeuroBridge_V7_Final.exe` y seleccionar el botón **"MI PC"** en el panel web. Así, la conexión saldrá de tu internet local y Binance te dejará entrar sin problemas.

2. **Llaves Distintas:**
   Las llaves API de tu cuenta REAL de Binance NO sirven para conectarte en modo DEMO. Binance utiliza dos bases de datos completamente diferentes. A continuación, te explicamos cómo sacar cada una.

---

## 2. Cómo conectar en Cuenta DEMO (Práctica sin riesgo)

En modo DEMO, Binance te dará un saldo virtual de prueba (USDT de mentira) para que pruebes la inteligencia del bot sin arriesgar ni un solo centavo de tu bolsillo.

### Paso a paso:
1. Asegúrate de tener abierta la aplicación `NeuroBridge_V7_Final.exe` en tu computadora y de que la pantalla de NeuroTrade tenga activado el **MODO DEL PUENTE: MI PC**.
2. Ve a la página oficial de pruebas de Binance: **https://testnet.binance.vision/**
3. Haz clic en **Log in** e inicia sesión usando una cuenta de GitHub. (Si no tienes GitHub, puedes crear una cuenta gratuita en 1 minuto).
4. Una vez dentro, haz clic en el enlace azul que dice **"Generate HMAC-SHA-256 Key"**.
5. Ponle una descripción a la llave (por ejemplo: "NeuroTrade") y acepta.
6. En pantalla aparecerán dos códigos muy largos: **API Key** y **Secret Key**. ¡Cópialos en un bloc de notas porque el Secret Key solo se muestra una sola vez!
7. Regresa a tu panel de NeuroTrade:
   - En **Motor de Trading**, selecciona **BINANCE**.
   - Pega tu **API Key** y tu **API Secret** en las casillas correspondientes.
   - En **Tipo de Cuenta**, asegúrate de tener seleccionado **DEMO**.
8. Haz clic en el botón azul **ACTIVAR VÍNCULO SEGURO**. 
9. ¡Listo! Verás cómo el sistema se conecta y te muestra un saldo de prueba (ej. 10,000 USDT virtuales).

---

## 3. Cómo conectar en Cuenta REAL (Operar de verdad)

Cuando estés listo para que el bot opere con tu capital real, usarás tu cuenta de Binance normal.

### Paso a paso:
1. Inicia sesión en tu cuenta oficial en **https://www.binance.com/**
2. Debes tener tu cuenta verificada (KYC) y algo de saldo en USDT (Binance exige tener saldo mínimo para habilitar APIs de trading, usualmente el equivalente a unos pocos dólares).
3. Ve a tu Perfil (el icono de usuario) y selecciona **Gestión de API** (API Management).
4. Haz clic en **Crear API** -> **Generada por el sistema (System generated)** -> Ponle un nombre (ej. "NeuroTrade Bot").
5. Pasa los controles de seguridad (SMS o Autenticador).
6. Una vez creada la API, haz clic en **Editar Restricciones**.
7. **MUY IMPORTANTE:** Marca la casilla que dice **"Habilitar Spot y Margin Trading"**. (Por seguridad, NO marques la casilla de Retiros, así el bot jamás podrá sacar tu dinero).
8. Guarda los cambios.
9. Copia tu **API Key** y tu **Secret Key**.
10. Regresa a tu panel de NeuroTrade:
    - En **Motor de Trading**, selecciona **BINANCE**.
    - Pega tus nuevas llaves.
    - En **Tipo de Cuenta**, selecciona la opción **REAL**.
    - Asegúrate de seguir usando el modo **MI PC**.
11. Haz clic en **ACTIVAR VÍNCULO SEGURO** y el bot leerá tu saldo real, ¡listo para operar en el Piloto Automático!

---

## 4. Solución a Errores Comunes

- **Error Crítico 451 (Restricted Location):** Significa que intentaste usar el puente de la nube (Render) que está en Estados Unidos. Solución: Cierra sesión, asegúrate de abrir tu archivo `.exe` local, cambia el modo a "MI PC" e inténtalo de nuevo.
- **Error Crítico (Credenciales Inválidas):** Significa que pegaste llaves de cuenta REAL intentando entrar en DEMO, o viceversa. Asegúrate de que el botón que tienes presionado en NeuroTrade (DEMO o REAL) coincida exactamente con la página de donde sacaste la llave (`testnet.binance.vision` = Demo | `binance.com` = Real).
- **Puente Offline:** Si NeuroTrade dice que el puente "MI PC" está Offline, significa que cerraste la ventana negra/gráfica del `NeuroBridge_V7` o tu antivirus la bloqueó. Ábrela y verifica que no esté pausada.

---
*Fin del Manual. ¡Mucho éxito en tus operaciones!*
