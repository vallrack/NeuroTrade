@echo off
echo ============================================
echo   NEUROTRADE V7 - PUENTE LOCAL (MI PC)
echo ============================================
echo.

if exist "dist\NeuroTrade_Bridge.exe" (
    echo Usando ejecutable: dist\NeuroTrade_Bridge.exe
    echo.
    dist\NeuroTrade_Bridge.exe
) else if exist "NeuroTrade_Bridge.exe" (
    echo Usando ejecutable: NeuroTrade_Bridge.exe
    echo.
    NeuroTrade_Bridge.exe
) else (
    echo Ejecutable no encontrado. Usando Python...
    echo Para crear el .exe ejecute: build-bridge-exe.bat
    echo.
    python bridge_server.py
)

pause
