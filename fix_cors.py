# -*- coding: utf-8 -*-
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Import flask_cors
    if 'from flask_cors import CORS' not in content:
        content = content.replace('from flask import Flask, request, jsonify', 'from flask import Flask, request, jsonify\nfrom flask_cors import CORS')

    # 2. Add PNA headers
    pna_code = '''
# Configuracion CORS global
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "X-Bridge-Token", "Bypass-Tunnel-Reminder", "Cache-Control", "Authorization", "Access-Control-Request-Private-Network"],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=False
)

@app.after_request
def add_pna_headers(response):
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response
'''
    # Remove any existing CORS blocks to avoid duplicates
    content = re.sub(r'# Configuración CORS.*?\n(?:CORS\(.*?\)|@app\.after_request.*?return response)', '', content, flags=re.DOTALL)
    content = re.sub(r'# Configuracion CORS.*?\n(?:CORS\(.*?\)|@app\.after_request.*?return response)', '', content, flags=re.DOTALL)
    
    # Insert CORS right after app = Flask(__name__)
    content = content.replace('app = Flask(__name__)', 'app = Flask(__name__)\n' + pna_code)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('iq_worker.py')
fix_file('binance_worker.py')
