// Works with date-fns v2.x + date-fns-tz v1.3.7 (CJS)

import dateFnsTz from "date-fns-tz";
import { endOfDay, addDays } from "date-fns";

const {
  utcToZonedTime,
  zonedTimeToUtc,
  formatInTimeZone,
} = dateFnsTz;

/* -----------------------------------------------------------------------
 *  IANA timezone helpers
 * -------------------------------------------------------------------- */

export function isValidIanaZone(tz) {
  if (typeof tz !== "string" || !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function nowUtc() {
  return new Date();
}

/**
 * Convert a local wall-clock date/time (interpreted in tz) → UTC Date
 */
export function localToUtc(localISOOrDate, tz) {
  const d =
    typeof localISOOrDate === "string"
      ? new Date(localISOOrDate)
      : localISOOrDate;
  return zonedTimeToUtc(d, tz);
}

/**
 * Convert a UTC instant → Date in a target timezone
 */
export function utcToZoned(utcISOOrDate, tz) {
  const d =
    typeof utcISOOrDate === "string"
      ? new Date(utcISOOrDate)
      : utcISOOrDate;
  return utcToZonedTime(d, tz);
}

/**
 * Format a UTC instant in a target timezone
 */
export function formatInTz(
  utcISOOrDate,
  tz,
  pattern = "dd MMM yyyy, HH:mm"
) {
  const d =
    typeof utcISOOrDate === "string"
      ? new Date(utcISOOrDate)
      : utcISOOrDate;
  return formatInTimeZone(d, tz, pattern);
}

/* -----------------------------------------------------------------------
 *  Day/Range utilities
 * -------------------------------------------------------------------- */

export function dayRangeUtcFromLocalDate(localDateYYYYMMDD, tz) {
  const startLocalStr = `${localDateYYYYMMDD}T00:00:00.000`;
  const endLocalStr = `${localDateYYYYMMDD}T23:59:59.999`;

  return {
    utcStart: zonedTimeToUtc(new Date(startLocalStr), tz),
    utcEnd: zonedTimeToUtc(new Date(endLocalStr), tz),
  };
}

export function weekRangeUtcFromLocalStartDay(localStartYYYYMMDD, tz) {
  const startLocal = new Date(`${localStartYYYYMMDD}T00:00:00.000`);
  const utcStart = zonedTimeToUtc(startLocal, tz);

  const startLocalZoned = utcToZonedTime(utcStart, tz);
  const endLocalZoned = endOfDay(addDays(startLocalZoned, 6));
  const utcEnd = zonedTimeToUtc(endLocalZoned, tz);

  return { utcStart, utcEnd };
}

export function rangeUtcFromLocalMinutes(
  localDateYYYYMMDD,
  tz,
  startMinutes,
  endMinutes
) {
  const toHHMM = (mins) => {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}:00.000`;
  };

  const startLocal = new Date(
    `${localDateYYYYMMDD}T${toHHMM(startMinutes)}`
  );
  const endLocal = new Date(
    `${localDateYYYYMMDD}T${toHHMM(endMinutes)}`
  );

  return {
    utcStart: zonedTimeToUtc(startLocal, tz),
    utcEnd: zonedTimeToUtc(endLocal, tz),
  };
}

export function localIsoToUtcIso(localISO, tz) {
  return zonedTimeToUtc(new Date(localISO), tz).toISOString();
}

export function prettyLocal(utcISO, tz, pattern) {
  return formatInTz(utcISO, tz, pattern);
}
