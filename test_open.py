from iqoptionapi.stable_api import IQ_Option
import time
import os

email = os.environ.get("IQ_EMAIL", "jdmoralescorproe@gmail.com")
password = os.environ.get("IQ_PASS", "Colombia2026.")
iq = IQ_Option(email, password)
iq.connect()

print("Connected!")
try:
    binary_data = iq.get_all_init_v2()
    print("Binary data fetched")
except Exception as e:
    print("Error binary", e)

try:
    digital_data = iq.get_digital_underlying_list_data()
    print("Digital data fetched")
except Exception as e:
    print("Error digital", e)
