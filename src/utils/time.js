// Works with date-fns v3 + date-fns-tz v3

import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { endOfDay, addDays } from "date-fns";

/* -----------------------------------------------------------------------
 *  IANA timezone helpers
 * -------------------------------------------------------------------- */

/**
 * Validate if a timezone string is a valid IANA zone
 */
export function isValidIanaZone(tz) {
  if (typeof tz !== "string" || !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Return current UTC Date object
 */
export function nowUtc() {
  return new Date();
}

/**
 * Convert a local wall-clock date/time (interpreted in tz) → UTC Date
 */
export function localToUtc(localISOOrDate, tz) {
  const d = typeof localISOOrDate === "string" ? new Date(localISOOrDate) : localISOOrDate;
  return fromZonedTime(d, tz);
}

/**
 * Convert a UTC instant → Date in a target timezone (keeps same instant)
 */
export function utcToZoned(utcISOOrDate, tz) {
  const d = typeof utcISOOrDate === "string" ? new Date(utcISOOrDate) : utcISOOrDate;
  return toZonedTime(d, tz);
}

/**
 * Format a UTC instant in a target timezone
 */
export function formatInTz(utcISOOrDate, tz, pattern = "dd MMM yyyy, HH:mm") {
  const d = typeof utcISOOrDate === "string" ? new Date(utcISOOrDate) : utcISOOrDate;
  return formatInTimeZone(d, tz, pattern);
}

/* -----------------------------------------------------------------------
 *  Day/Range utilities (compute boundaries in user's timezone, then to UTC)
 * -------------------------------------------------------------------- */

/**
 * Given a local calendar day like "2025-10-25" and a tz, return UTC range
 * covering that entire local day.
 */
export function dayRangeUtcFromLocalDate(localDateYYYYMMDD, tz) {
  const startLocalStr = `${localDateYYYYMMDD}T00:00:00.000`;
  const endLocalStr = `${localDateYYYYMMDD}T23:59:59.999`;

  const utcStart = fromZonedTime(new Date(startLocalStr), tz);
  const utcEnd = fromZonedTime(new Date(endLocalStr), tz);

  return { utcStart, utcEnd };
}

/**
 * Given a local starting day and tz, return a 7-day UTC window
 * (start-of-day of localStart through end-of-day of localStart + 6)
 */
export function weekRangeUtcFromLocalStartDay(localStartYYYYMMDD, tz) {
  const startLocal = new Date(`${localStartYYYYMMDD}T00:00:00.000`);
  const utcStart = fromZonedTime(startLocal, tz);

  const startLocalZoned = toZonedTime(utcStart, tz);
  const endLocalZoned = endOfDay(addDays(startLocalZoned, 6));
  const utcEnd = fromZonedTime(endLocalZoned, tz);

  return { utcStart, utcEnd };
}

/**
 * Build a UTC range for arbitrary local minutes within a local day.
 * Example: 540..600 ⇒ 09:00–10:00 local → [UTC, UTC]
 */
export function rangeUtcFromLocalMinutes(localDateYYYYMMDD, tz, startMinutes, endMinutes) {
  const toHHMM = (mins) => {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}:00.000`;
  };

  const startLocal = new Date(`${localDateYYYYMMDD}T${toHHMM(startMinutes)}`);
  const endLocal = new Date(`${localDateYYYYMMDD}T${toHHMM(endMinutes)}`);

  return {
    utcStart: fromZonedTime(startLocal, tz),
    utcEnd: fromZonedTime(endLocal, tz),
  };
}

/**
 * Convert an ISO "local" pick (e.g., from datepicker) → UTC ISO string
 */
export function localIsoToUtcIso(localISO, tz) {
  return localToUtc(localISO, tz).toISOString();
}

/**
 * Pretty-print a UTC ISO for the given timezone
 */
export function prettyLocal(utcISO, tz, pattern) {
  return formatInTz(utcISO, tz, pattern);
}
