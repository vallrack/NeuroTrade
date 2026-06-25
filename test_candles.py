import time
from iqoptionapi.stable_api import IQ_Option
import sys

iq = IQ_Option('neurotradepro@gmail.com', 'NeuroV7Pro')
iq.connect()
print('Connected:', iq.check_connect())
print('EURUSD-OTC:', len(iq.get_candles('EURUSD-OTC', 60, 10, time.time())))
print('EURUSDOTC:', len(iq.get_candles('EURUSDOTC', 60, 10, time.time())))
print('EURUSD:', len(iq.get_candles('EURUSD', 60, 10, time.time())))
