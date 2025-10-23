// totle-backend/src/middleware/timezone.js

/**
 * Reads the user's IANA timezone from:
 *   1) X-User-Timezone header (preferred)
 *   2) req.query.tz
 *   3) req.body.client_tz
 * Falls back to 'UTC' if invalid or missing.
 *
 * Sets:
 *   req.userTz                -> string (IANA tz like "Asia/Dubai")
 *   req.userOffsetMinutes     -> number (offset from UTC at *now*, e.g., 240)
 *
 * Mount AFTER express.json() so body is available.
 */

const FALLBACK_TZ = "UTC";

/** Validate IANA timezone by attempting to construct a formatter */
function isValidIanaZone(tz) {
  if (typeof tz !== "string" || !tz.includes("/")) return false;
  try {
    // Will throw if tz is invalid
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Compute the current offset (in minutes) for a given IANA zone */
function getOffsetMinutes(tz) {
  try {
    const now = new Date();
    // Format the time in the target tz and UTC, then diff
    const tzParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
    const tzIso = `${tzParts.year}-${tzParts.month}-${tzParts.day}T${tzParts.hour}:${tzParts.minute}:${tzParts.second}.000`;

    const localInTz = Date.parse(tzIso); // interpreted as local (but same wall clock)
    const utcNow = now.getTime();
    // Offset in minutes: (tzWallClock - utcNow)
    return Math.round((localInTz - utcNow) / 60000);
  } catch {
    return 0;
  }
}

export function timezoneMiddleware(req, _res, next) {
  // Prefer header; allow query/body overrides (useful in tooling)
  const headerTz = (req.headers["x-user-timezone"] || "").toString().trim();
  const queryTz = typeof req.query?.tz === "string" ? req.query.tz.trim() : "";
  const bodyTz =
    req.body && typeof req.body.client_tz === "string"
      ? req.body.client_tz.trim()
      : "";

  let tz = headerTz || queryTz || bodyTz || FALLBACK_TZ;
  if (!isValidIanaZone(tz)) tz = FALLBACK_TZ;

  req.userTz = tz;
  req.userOffsetMinutes = getOffsetMinutes(tz);

  // Optional: expose for downstream logs
  req.context = req.context || {};
  req.context.timezone = tz;

  next();
}

export default timezoneMiddleware;
