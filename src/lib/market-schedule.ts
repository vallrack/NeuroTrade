// src/lib/market-schedule.ts
// Lógica de horarios de mercado y selección automática de pares

export type ScheduleSlot = {
  id: string;
  label: string;
  days: number[];        // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  from: string;          // "HH:mm" en la zona horaria indicada
  to: string;            // "HH:mm"
  timezone: string;      // "America/Bogota"
  pairMode: 'auto' | 'regular' | 'otc';
  enabled: boolean;
};

export type AutopilotConfig = {
  enabled: boolean;
  autoConnectBridge: boolean;
  pairMode: 'auto' | 'manual';
  scheduleMode: 'always' | 'auto' | 'custom';
  slots: ScheduleSlot[];
};

export type MarketStatus = {
  active: boolean;
  label: string;
  sublabel: string;
  pairType: 'regular' | 'otc' | 'none';
  activeSlot: ScheduleSlot | null;
  minutesUntilChange: number;
};

// ─── Utilidades de tiempo ────────────────────────────────────────────────────

/** Devuelve la hora actual en una zona horaria como "HH:mm" */
function getCurrentTimeInZone(timezone: string): { hours: number; minutes: number; day: number } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(now);

    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');

    // Obtener el día de la semana en la zona horaria correcta
    const dayName = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const day = dayMap[dayName] ?? new Date().getDay();

    return { hours: hour, minutes: minute, day };
  } catch {
    // Fallback: usar UTC
    const now = new Date();
    return { hours: now.getUTCHours(), minutes: now.getUTCMinutes(), day: now.getUTCDay() };
  }
}

/** Convierte "HH:mm" a minutos desde medianoche */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Verifica si la hora actual está dentro de un rango */
function isTimeInRange(
  currentHours: number,
  currentMinutes: number,
  from: string,
  to: string
): boolean {
  const currentMins = currentHours * 60 + currentMinutes;
  const fromMins = timeToMinutes(from);
  const toMins = timeToMinutes(to);

  if (fromMins <= toMins) {
    return currentMins >= fromMins && currentMins < toMins;
  } else {
    // Cruce de medianoche (ej: 22:00 → 06:00)
    return currentMins >= fromMins || currentMins < toMins;
  }
}

// ─── Detección automática de mercado IQ Option ───────────────────────────────

/**
 * Detecta si el mercado Forex de IQ Option está abierto.
 * Horario: Lunes 00:00 UTC – Viernes 20:59 UTC
 */
export function isForexMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();    // 0=Dom, 1=Lun...6=Sáb
  const utcHour = now.getUTCHours();

  // Sábado y Domingo: cerrado todo el día
  if (utcDay === 6 || utcDay === 0) return false;

  // Lunes a Viernes: las opciones de pares regulares cierran por la noche (de 20:00 a 05:00 UTC del día siguiente)
  // Durante ese horario solo operan los pares OTC
  if (utcHour < 5 || utcHour >= 20) return false;

  return true;
}

// ─── Análisis de slots personalizados ───────────────────────────────────────

/** Verifica si hay algún slot activo en este momento */
export function isCurrentlyInSchedule(slots: ScheduleSlot[]): { active: boolean, slot: ScheduleSlot | null } {
  if (!slots || slots.length === 0) return { active: false, slot: null };
  const activeSlot = slots.find(s => {
    if (!s.enabled) return false;
    const { hours, minutes, day } = getCurrentTimeInZone(s.timezone || 'America/Bogota');
    if (!(s.days || []).includes(day)) return false;
    
    if (!s.from || !s.to) return false;
    return isTimeInRange(hours, minutes, s.from, s.to);
  });

  return activeSlot ? { active: true, slot: activeSlot } : { active: false, slot: null };
}

/** Calcula cuántos minutos faltan para el próximo inicio/fin de slot */
export function getMinutesUntilNextSlotChange(slots: ScheduleSlot[]): number {
  if (!slots || slots.length === 0) return 60;

  const enabledSlots = slots.filter(s => s.enabled);
  if (enabledSlots.length === 0) return 60;

  // Aproximación simple: revisar en los próximos 24 horas (en intervalos de 1 minuto)
  const now = new Date();
  for (let i = 1; i <= 1440; i++) {
    const future = new Date(now.getTime() + i * 60 * 1000);
    const tempNow = { active: false };

    for (const slot of enabledSlots) {
      const tz = slot.timezone || 'America/Bogota';
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
      }).formatToParts(future);
      const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
      const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
      const dayName = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const d = dayMap[dayName] ?? 1;

      if (slot.days.includes(d) && isTimeInRange(h, m, slot.from, slot.to)) {
        return i; // Minutos hasta que comience el próximo slot
      }
    }
  }

  return 60;
}

// ─── Función principal: obtener pares activos ─────────────────────────────────

/**
 * Retorna los pares que el bot debe usar en este momento,
 * basándose en la configuración de autopilot.
 */
export function getActivePairs(
  autopilot: AutopilotConfig,
  regularPairs: string[],
  otcPairs: string[],
  manualPairs: string[]
): { pairs: string[]; reason: string } {

  // Si autopilot está desactivado o modo manual de pares, usar los pares configurados manualmente
  if (!autopilot.enabled || autopilot.pairMode === 'manual') {
    return { pairs: manualPairs.length > 0 ? manualPairs : otcPairs, reason: 'manual' };
  }

  const reg = regularPairs.length > 0 ? regularPairs : ['EURUSD', 'GBPUSD', 'USDJPY'];
  const otc = otcPairs.length > 0 ? otcPairs : ['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC'];

  switch (autopilot.scheduleMode) {
    case 'always':
      // Siempre activo: elegir tipo de par según mercado
      if (isForexMarketOpen()) {
        return { pairs: reg, reason: 'Mercado abierto — pares regulares' };
      } else {
        return { pairs: otc, reason: 'Mercado cerrado — pares OTC' };
      }

    case 'auto':
      // Detección automática IQ Option
      if (isForexMarketOpen()) {
        return { pairs: reg, reason: 'Mercado Forex abierto — pares regulares' };
      } else {
        return { pairs: otc, reason: 'Mercado Forex cerrado — pares OTC' };
      }

    case 'custom': {
      const { active, slot } = isCurrentlyInSchedule(autopilot.slots || []);

      if (!active) {
        return { pairs: [], reason: 'Fuera de horario programado' };
      }

      // Determinar pares según la configuración del slot
      if (slot!.pairMode === 'regular') return { pairs: reg, reason: `Slot: ${slot!.label} — pares regulares` };
      if (slot!.pairMode === 'otc') return { pairs: otc, reason: `Slot: ${slot!.label} — pares OTC` };

      // pairMode === 'auto' en el slot: detectar por mercado
      if (isForexMarketOpen()) {
        return { pairs: reg, reason: `Slot: ${slot!.label} — mercado abierto` };
      } else {
        return { pairs: otc, reason: `Slot: ${slot!.label} — mercado cerrado` };
      }
    }

    default:
      return { pairs: manualPairs, reason: 'manual' };
  }
}

/** Genera el estado del mercado para mostrar en la UI */
export function getMarketStatus(
  autopilot: AutopilotConfig,
  regularPairs: string[],
  otcPairs: string[],
  manualPairs: string[]
): MarketStatus {

  if (!autopilot.enabled) {
    return {
      active: true,
      label: 'Control Manual',
      sublabel: 'AutoPilot desactivado',
      pairType: manualPairs.length > 0 ? 'regular' : 'none',
      activeSlot: null,
      minutesUntilChange: 0,
    };
  }

  const { pairs, reason } = getActivePairs(autopilot, regularPairs, otcPairs, manualPairs);
  const forexOpen = isForexMarketOpen();

  if (pairs.length === 0) {
    const mins = autopilot.scheduleMode === 'custom'
      ? getMinutesUntilNextSlotChange(autopilot.slots || [])
      : 0;
    return {
      active: false,
      label: 'Fuera de Horario',
      sublabel: `Próximo horario en ${mins} min`,
      pairType: 'none',
      activeSlot: autopilot.scheduleMode === 'custom'
        ? isCurrentlyInSchedule(autopilot.slots || []).slot
        : null,
      minutesUntilChange: mins,
    };
  }

  const isOtc = pairs[0]?.includes('-OTC');

  return {
    active: true,
    label: forexOpen ? '🟢 Mercado Abierto' : '🟡 Mercado Cerrado',
    sublabel: reason,
    pairType: isOtc ? 'otc' : 'regular',
    activeSlot: autopilot.scheduleMode === 'custom'
      ? isCurrentlyInSchedule(autopilot.slots || []).slot
      : null,
    minutesUntilChange: 0,
  };
}

/** Lista de todos los pares disponibles en IQ Option */
export const ALL_REGULAR_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY',
  'CADCHF', 'AUDJPY', 'GBPCAD', 'EURAUD', 'AUDCAD',
  'CHFJPY', 'CADJPY', 'NZDJPY', 'GBPAUD', 'EURNZD',
];

export const ALL_OTC_PAIRS = [
  'EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC', 'AUDUSD-OTC',
  'USDCAD-OTC', 'USDCHF-OTC', 'NZDUSD-OTC', 'EURGBP-OTC',
  'EURJPY-OTC', 'GBPJPY-OTC', 'AUDCAD-OTC', 'EURCAD-OTC',
  'EURCHF-OTC', 'AUDCHF-OTC', 'CADCHF-OTC', 'AUDNZD-OTC',
  'GBPCAD-OTC', 'NZDCAD-OTC', 'CHFJPY-OTC', 'GBPCHF-OTC',
  'EURAUD-OTC', 'GBPAUD-OTC', 'NZDCHF-OTC', 'SGDJPY-OTC',
];

export const ALL_CRYPTO_PAIRS = [
  'BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'EOSUSD',
  'BCHUSD', 'ETCUSD', 'DSHUSD', 'ZECUSD', 'OMGUSD',
  'TRXUSD', 'QTMUSD', 'ZRXUSD', 'BTCUSD-OTC', 'ETHUSD-OTC'
];

export const ALL_STOCKS = [
  'AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOG', 'META', 
  'SNAP', 'NFLX', 'BA', 'MCD', 'NKE', 'KO', 'JNJ',
  'BABA', 'NVDA', 'AMD', 'INTC', 'Gold', 'Silver', 'Crude Oil WTI'
];

export const TIMEZONES = [
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Mexico_City', label: 'México (CST)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (ART)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (BRT)' },
  { value: 'Europe/London', label: 'Londres (GMT)' },
  { value: 'Europe/Paris', label: 'Europa Central (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokio (JST)' },
  { value: 'UTC', label: 'UTC' },
];
