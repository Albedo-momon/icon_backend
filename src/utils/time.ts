export const IST_TIME_ZONE = 'Asia/Kolkata';

/**
 * Convert an input date-like value to a JS Date suitable for DB insertion.
 * - If the string has an explicit timezone (Z or +/-hh:mm), it is parsed as-is.
 * - If the string is naive (no timezone), it is interpreted as IST local time
 *   and converted to the corresponding UTC instant.
 * - If the value is already a Date, it is returned unchanged.
 * - Returns null for null/undefined/invalid inputs.
 */
export function toDbDate(value: string | Date | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  // Explicit timezone marker in the string
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // Naive local date-time string: YYYY-MM-DD HH:mm:ss(.SSS?) or with 'T'
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (m) {
    const year = parseInt(m[1]!, 10);
    const month = parseInt(m[2]!, 10) - 1;
    const day = parseInt(m[3]!, 10);
    const hour = parseInt(m[4]!, 10);
    const minute = parseInt(m[5]!, 10);
    const second = parseInt(m[6] ?? '0', 10);
    const msPart = m[7] ?? '0';
    const millisecond = +(msPart + '000').slice(0, 3);
    // IST offset is UTC+05:30 — subtract to get UTC instant
    const utcMs = Date.UTC(year, month, day, hour - 5, minute - 30, second, millisecond);
    return new Date(utcMs);
  }
  // Fallback: let Date parse it (may assume local/UTC depending on format)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date into an IST string for presentation (not for DB storage).
 * Output: YYYY-MM-DD HH:mm:ss.SSS IST
 */
export function formatIST(value: Date | string | number | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hh = get('hour');
  const mi = get('minute');
  const ss = get('second');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms} IST`;
}

// Append IST-formatted mirrors for specified date keys on an object.
export function addISTFields<T extends Record<string, any>>(obj: T, keys: string[]): T {
  const out: any = { ...obj };
  for (const k of keys) {
    out[`${k}IST`] = formatIST((obj as any)[k]);
  }
  return out as T;
}