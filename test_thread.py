import concurrent.futures

def my_func():
    raise KeyError('EURUSDOTC')

executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
future = executor.submit(my_func)
try:
    future.result()
except KeyError:
    print("Caught KeyError!")
except Exception as e:
    print("Caught Exception:", repr(str(e)))
