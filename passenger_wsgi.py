import sys
import os

# Añade el directorio actual al PATH para que Python encuentre los archivos
sys.path.insert(0, os.path.dirname(__file__))

# Importa el objeto 'app' de tu bridge_server.py y renómbralo como 'application'
# Esto es lo que cPanel/Passenger necesita para arrancar la web
try:
    from bridge_server import app as application
except Exception as e:
    # Si falla, imprimimos el error para que salga en el stderr.log de cPanel
    print("Error al importar bridge_server:", str(e))
    raise
