# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec — genera dist/NeuroTrade_Bridge.exe
# Uso: pyinstaller NeuroTrade_Bridge.spec

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Empaquetar dependencias completas de iqoptionapi y flask
iq_datas, iq_binaries, iq_hiddenimports = collect_all('iqoptionapi')
flask_datas, flask_binaries, flask_hiddenimports = collect_all('flask')
ccxt_datas, ccxt_binaries, ccxt_hiddenimports = collect_all('ccxt')

hiddenimports = (
    collect_submodules('iqoptionapi')
    + collect_submodules('websocket')
    + iq_hiddenimports
    + flask_hiddenimports
    + ccxt_hiddenimports
    + [
        'flask_cors',
        'werkzeug',
        'jinja2',
        'requests',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',
    ]
)

a = Analysis(
    ['bridge_server.py'],
    pathex=[],
    binaries=iq_binaries + flask_binaries + ccxt_binaries,
    datas=iq_datas + flask_datas + ccxt_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['gunicorn', 'matplotlib', 'numpy', 'pandas', 'tkinter'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='NeuroTrade_Bridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
