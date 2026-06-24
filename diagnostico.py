import time
import logging
from iqoptionapi.stable_api import IQ_Option

# ==========================================
# 1. PON AQUÍ LAS CREDENCIALES DEL CLIENTE
# ==========================================
EMAIL = "danielestebantoromejia@gmail.com"
PASSWORD = "DANIELTHEBESt123@"
MONTO_PRUEBA = 500  # Pon el monto que el cliente usa normalmente (ej. 500 o 2000)

# ==========================================

def test_trade():
    print("=== SCRIPT DE DIAGNÓSTICO PROFUNDO IQ OPTION ===")
    
    # Prender los "Rayos X" (Veremos cada mensaje crudo del servidor)
    logging.basicConfig(level=logging.DEBUG, format='[SERVER] %(message)s')
    
    print("\n[1] Conectando...")
    iq = IQ_Option(EMAIL, PASSWORD)
    check, reason = iq.connect()
    
    if not check:
        print(f"❌ Error de conexión: {reason}")
        return
        
    print("✅ Conectado exitosamente.")
    
    # Asegurarnos de que estamos en DEMO
    iq.change_balance("PRACTICE")
    print(f"💰 Balance DEMO actual: {iq.get_balance()}")
    
    pair = "EURUSD-OTC" 
    action = "call"
    
    print(f"\n[2] Intentando enviar orden de {MONTO_PRUEBA} en {pair}...")
    
    # ----------------------------------------------------
    # INTENTO A: Binarias tradicionales (Sin guion)
    # ----------------------------------------------------
    print("\n--- Intento A: BINARIA (EURUSDOTC) ---")
    try:
        check_a, id_a = iq.buy(MONTO_PRUEBA, pair.replace("-", ""), action, 1)
        print(f"Respuesta: Exito={check_a}, ID/Error={id_a}")
    except Exception as e:
        print(f"Crash en Intento A: {str(e)}")

    # ----------------------------------------------------
    # INTENTO B: Binarias forzadas (Con guion)
    # ----------------------------------------------------
    print("\n--- Intento B: BINARIA FORZADA (EURUSD-OTC) ---")
    try:
        check_b, id_b = iq.buy(MONTO_PRUEBA, pair, action, 1)
        print(f"Respuesta: Exito={check_b}, ID/Error={id_b}")
    except Exception as e:
        print(f"Crash en Intento B: {str(e)}")
        
    # ----------------------------------------------------
    # INTENTO C: Opciones Digitales
    # ----------------------------------------------------
    print("\n--- Intento C: DIGITAL (EURUSD-OTC) ---")
    try:
        check_c, id_c = iq.buy_digital_spot(pair, MONTO_PRUEBA, action, 1)
        print(f"Respuesta: Exito={check_c}, ID/Error={id_c}")
    except Exception as e:
        print(f"Crash en Intento C: {str(e)}")

if __name__ == "__main__":
    if EMAIL == "CORREO_AQUI":
        print("❌ Por favor, pon el correo y contraseña en el archivo antes de correrlo.")
    else:
        test_trade()
