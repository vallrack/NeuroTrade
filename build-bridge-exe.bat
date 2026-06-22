@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   NEUROTRADE V7 - BUILD NeuroTrade_Bridge.exe
echo ============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado. Instale Python 3.10+ desde python.org
    pause
    exit /b 1
)

echo [1/3] Instalando dependencias...
python -m pip install --upgrade pip
python -m pip install -r requirements-build.txt
if errorlevel 1 (
    echo [ERROR] Fallo al instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [2/3] Compilando ejecutable (puede tardar 2-5 minutos)...
taskkill /F /IM NeuroTrade_Bridge.exe >nul 2>&1
python -m PyInstaller --noconfirm --clean NeuroTrade_Bridge.spec
if errorlevel 1 (
    echo [ERROR] PyInstaller fallo. Revise los mensajes arriba.
    pause
    exit /b 1
)

echo.
echo [3/3] Listo!
echo.
echo   Ejecutable: dist\NeuroTrade_Bridge.exe
echo   Puerto:     5000  (variable PORT para cambiar)
echo   Token:      neurotrade-secret-2024  (variable BRIDGE_TOKEN)
echo.
echo   En Broker Link - modo MI PC - use: http://127.0.0.1:5000
echo   Desde Vercel use localtunnel: npx localtunnel --port 5000
echo.
pause
