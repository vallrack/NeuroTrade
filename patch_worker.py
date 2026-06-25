import re

with open("iq_worker.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Fix get_open_map and asset_status
code = re.sub(
    r"def get_open_map.*?return data",
    "def get_open_map(force=False):\n    return None",
    code,
    flags=re.DOTALL
)
code = re.sub(
    r"def asset_status.*?return status, True",
    'def asset_status(pair):\n    return {"binary": False, "turbo": False, "digital": False}, False',
    code,
    flags=re.DOTALL
)

# 2. Fix fallback logic in /trade
trade_fallback_old = """        if not use_binary and not use_digital:
            if open_known:
                # IQ confirmó que el activo está cerrado: respuesta inmediata y clara.
                return jsonify({
                    "success": False,
                    "error": f"Mercado cerrado para {pair}. Ningún instrumento (binaria/digital) está abierto ahora."
                }), 400
            # Estado desconocido (IQ no respondió): intentamos binaria y si falla digital
            print(f"[WORKER {WORKER_PORT}] Estado de apertura desconocido para {pair}. Intento binaria y luego digital.")
            use_binary = True
            use_digital = True

        # ── 1) Binaria / Turbo (la llamada buy() tiene timeout interno de 5s) ──
        if use_binary:
            try:
                print(f"[WORKER {WORKER_PORT}] Intentando compra binaria/turbo en {trade_pair}...")
                # Verificación explícita para evitar KeyError antes de llamar a buy()
                actives_ahora = iq_instance.get_all_ACTIVES_OPCODE()
                if trade_pair not in actives_ahora:
                    raise KeyError(trade_pair)

                check, order_id = run_with_timeout(
                    lambda: iq_instance.buy(amount, trade_pair, dir_lower, expiration), 10
                )
                if check:
                    trade_mode = "binary"
            except concurrent.futures.TimeoutError:
                print(f"[WORKER {WORKER_PORT}] Timeout en binaria para {trade_pair}.")
                check = False
            except KeyError as ke:
                print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en OP_code.ACTIVES (Binaria). Probando digital...")
                check = False
            except Exception as e:
                print(f"[WORKER {WORKER_PORT}] Excepción en binaria {trade_pair}: {e}")
                import traceback
                traceback.print_exc()
                check = False

        # ── 2) Digital (solo si binaria falló o no estaba disponible) ──
        if not check and use_digital:
            print(f"[WORKER {WORKER_PORT}] Ejecutando {dir_lower} {amount} en {trade_pair} (Digital)")
            try:
                check, order_id = run_with_timeout(
                    lambda: iq_instance.buy_digital_spot(trade_pair, amount, dir_lower, expiration), 12
                )
                if check:
                    trade_mode = "digital"
            except concurrent.futures.TimeoutError:
                return jsonify({"success": False, "error": "IQ Option no respondió a la compra digital (timeout)."}), 400
            except KeyError as ke:
                print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en Digital. Operación abortada.")
                check = False
                order_id = f"Activo no disponible en Digital: {ke}"
            except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({"success": False, "error": f"Excepción en compra digital: {str(e)}"}), 500"""

trade_fallback_new = """        print(f"[WORKER {WORKER_PORT}] Smart Fallback para {pair}. Evaluando binaria o digital...")
        if "-OTC" in pair:
            try_first, try_second = "digital", "binary"
        else:
            try_first, try_second = "binary", "digital"

        def attempt_trade(mode):
            nonlocal check, order_id, trade_mode
            if mode == "binary":
                try:
                    print(f"[WORKER {WORKER_PORT}] Intentando compra binaria/turbo en {trade_pair}...")
                    actives_ahora = iq_instance.get_all_ACTIVES_OPCODE()
                    if trade_pair not in actives_ahora:
                        raise KeyError(trade_pair)

                    ok, oid = run_with_timeout(
                        lambda: iq_instance.buy(amount, trade_pair, dir_lower, expiration), 10
                    )
                    if ok:
                        check, order_id, trade_mode = True, oid, "binary"
                except concurrent.futures.TimeoutError:
                    print(f"[WORKER {WORKER_PORT}] Timeout en binaria para {trade_pair}.")
                except KeyError as ke:
                    print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en OP_code.ACTIVES (Binaria).")
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Excepción en binaria {trade_pair}: {e}")

            elif mode == "digital":
                print(f"[WORKER {WORKER_PORT}] Ejecutando {dir_lower} {amount} en {trade_pair} (Digital)")
                try:
                    ok, oid = run_with_timeout(
                        lambda: iq_instance.buy_digital_spot(trade_pair, amount, dir_lower, expiration), 12
                    )
                    if ok:
                        check, order_id, trade_mode = True, oid, "digital"
                except concurrent.futures.TimeoutError:
                    print(f"[WORKER {WORKER_PORT}] Timeout en digital para {trade_pair}.")
                except KeyError as ke:
                    print(f"[WORKER {WORKER_PORT}] El activo {ke} no existe en Digital. Operación abortada.")
                except Exception as e:
                    print(f"[WORKER {WORKER_PORT}] Excepción en digital {trade_pair}: {e}")

        attempt_trade(try_first)
        if not check and try_second:
            print(f"[WORKER {WORKER_PORT}] Falló {try_first}, intentando {try_second}...")
            attempt_trade(try_second)"""

if trade_fallback_old in code:
    code = code.replace(trade_fallback_old, trade_fallback_new)
else:
    print("Warning: trade_fallback_old not found!")

# 3. Fix wait_for_trade loop
wait_for_trade_old = """                    if t_mode == "digital":
                        closed, win = iq_obj.check_win_digital_v2(oid)
                        if closed:
                            profit = float(win)
                    else:
                        check, data = iq_obj.get_betinfo(oid)
                        if check and data:
                            try:
                                d = data["result"]["data"][str(oid)]
                                win = d.get("win", "")
                                if win != "":
                                    profit_val = d.get("profit", 0)
                                    deposit_val = d.get("deposit", 0)
                                    profit = float(profit_val) - float(deposit_val)
                            except (KeyError, TypeError, ValueError) as e:
                                print(f"[WORKER {WORKER_PORT}] Error parseando betinfo {oid}: {e}")"""

wait_for_trade_new = """                    if t_mode == "digital":
                        # Leer directamente del diccionario asíncrono para evitar el while True bloqueante
                        order = iq_obj.get_async_order(oid)
                        if order and order.get("position-changed", {}) != {}:
                            msg = order["position-changed"].get("msg")
                            if msg and msg.get("status") == "closed":
                                if msg.get("close_reason") == "expired":
                                    profit = float(msg.get("close_profit", 0)) - float(msg.get("invest", 0))
                                elif msg.get("close_reason") == "default":
                                    profit = float(msg.get("pnl_realized", 0))
                    else:
                        # Para binaria, pedimos betinfo sin usar la función bloqueante con reconexión
                        iq_obj.api.game_betinfo.isSuccessful = None
                        iq_obj.api.get_betinfo(oid)
                        time.sleep(1.5)  # Esperar respuesta
                        if iq_obj.api.game_betinfo.isSuccessful:
                            d = iq_obj.api.game_betinfo.dict.get("result", {}).get("data", {}).get(str(oid), {})
                            win = d.get("win", "")
                            if win != "":
                                profit = float(d.get("profit", 0)) - float(d.get("deposit", 0))"""

if wait_for_trade_old in code:
    code = code.replace(wait_for_trade_old, wait_for_trade_new)
else:
    print("Warning: wait_for_trade_old not found!")

with open("iq_worker.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patch applied successfully!")
