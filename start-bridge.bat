@echo off
echo ============================================
echo   NEUROTRADE V7 - PUENTE LOCAL (MI PC)
echo ============================================
echo.
echo Iniciando bridge_server.py en puerto 5000...
echo.
echo Para exponer a Vercel (app en la nube):
echo   1. Deja esta ventana abierta
echo   2. En otra terminal: npx localtunnel --port 5000
echo   3. Copia la URL generada (ej. https://xxx.loca.lt)
echo   4. En la app: Broker Link - modo MI PC - pega esa URL
echo.
python bridge_server.py
pause
