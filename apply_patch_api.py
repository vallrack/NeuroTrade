import os
import re

api_path = r"C:\Users\DOCENTE\AppData\Local\Programs\Python\Python314\Lib\site-packages\iqoptionapi\stable_api.py"

with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix buy method
content = re.sub(
    r"if time\.time\(\) - start_t >= 5:\s+logging\.error\('\*\*warning\*\* buy late 5 sec'\)",
    "if time.time() - start_t >= 5:\n                logging.error('**warning** buy late 5 sec')\n                return False, 'timeout'",
    content
)

# Fix buy_digital_spot
content = re.sub(
    r"while self\.api\.digital_option_placed_id\.get\(request_id\) == None:\s+pass",
    "start_t = time.time()\n        while self.api.digital_option_placed_id.get(request_id) == None:\n            if time.time() - start_t >= 5:\n                return False, 'timeout'\n            time.sleep(0.1)",
    content
)

# Fix buy_digital_spot_v2
content = re.sub(
    r"while self\.api\.digital_option_placed_id\.get\(request_id\) is None:\s+pass",
    "start_t = time.time()\n        while self.api.digital_option_placed_id.get(request_id) is None:\n            if time.time() - start_t >= 5:\n                return False, 'timeout'\n            time.sleep(0.1)",
    content
)

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("stable_api.py patched successfully!")
