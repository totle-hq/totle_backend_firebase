// src/services/sessionAvailability.service.js
import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";

/**
 * Add minutes to a Date (UTC instant preserved).
 * @param {Date} d
 * @param {number} mins
 * @returns {Date}
 */
function addMinutes(d, mins) {
  return new Date(d.getTime() + mins * 60000);
}

/**
 * Find all sessions that overlap a given window (inclusive of buffer).
 * Overlap test: (scheduled_at < windowEnd) AND (completed_at > windowStart)
 * This captures sessions that start before the window but extend into it.
 *
 * @param {string} teacherId
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {Promise<Array<{start: Date, end: Date}>>}
 */
async function getOverlappingSessions(teacherId, windowStart, windowEnd) {
  const rows = await Session.findAll({
    where: {
      teacher_id: teacherId,
      status: { [Op.in]: ["available", "booked", "upcoming"] },
      [Op.and]: [
        { scheduled_at: { [Op.lt]: windowEnd } },
        { completed_at: { [Op.gt]: windowStart } },
      ],
    },
    attributes: ["scheduled_at", "completed_at", "duration_minutes"],
    order: [["scheduled_at", "ASC"]],
    raw: true,
  });

  return rows.map((r) => {
    // Use persisted completed_at when present; otherwise derive via duration
    const start = new Date(r.scheduled_at);
    const end =
      r.completed_at
        ? new Date(r.completed_at)
        : addMinutes(start, Number(r.duration_minutes || 0));
    return { start, end };
  });
}

/**
 * Find the earliest start inside [availStart, availEnd] (UTC instants) such that:
 *   1) start >= now + minLeadMin (gate)
 *   2) [start, start+duration] fits fully inside availability window
 *   3) respects bufferMin before/after neighboring sessions
 *   4) considers sessions that overlap the window edges
 *
 * Returns a UTC Date if found, else null.
 *
 * @param {Object} params
 * @param {string} params.teacherId
 * @param {Date}   params.availStart
 * @param {Date}   params.availEnd
 * @param {number} [params.durationMin=90]
 * @param {number} [params.bufferMin=30]
 * @param {number} [params.minLeadMin=30]  // gate: soonest allowed from "now"
 * @returns {Promise<Date|null>}
 */
export async function findAvailableSlot({
  teacherId,
  availStart,
  availEnd,
  durationMin = 90,
  bufferMin = 30,
  minLeadMin = 30,
}) {
  if (!(availStart instanceof Date) || isNaN(availStart)) throw new Error("availStart must be a Date");
  if (!(availEnd instanceof Date) || isNaN(availEnd)) throw new Error("availEnd must be a Date");
  if (availEnd <= availStart) return null;

  // Gate: do not propose slots earlier than now + minLeadMin
  const now = new Date();
  const gateStart = addMinutes(now, minLeadMin);

  // Search window in UTC
  const windowStart = new Date(Math.max(availStart.getTime(), gateStart.getTime()));
  const windowEnd = new Date(availEnd);

  // If the gate already pushes beyond availability, no slot
  if (addMinutes(windowStart, durationMin) > windowEnd) return null;

  // Expand query window by buffer on both sides so we catch edge-overlaps
  const qStart = addMinutes(windowStart, -bufferMin);
  const qEnd = addMinutes(windowEnd, bufferMin);

  const sessions = await getOverlappingSessions(teacherId, qStart, qEnd);

  // Walk a cursor left→right, enforcing buffer gaps.
  // invariant: cursor is the earliest feasible start that already respects previous buffers.
  let cursor = new Date(windowStart);

  for (const s of sessions) {
    // Earliest end if we start at cursor
    const proposedEnd = addMinutes(cursor, durationMin);

    // To fit between [prev gap] and this session s with buffers:
    // [cursor, proposedEnd] must end no later than (s.start - bufferMin)
    const latestAllowedEndBeforeS = addMinutes(s.start, -bufferMin);

    if (proposedEnd <= latestAllowedEndBeforeS) {
      // Fits cleanly before this session with the required trailing buffer
      return cursor;
    }

    // Otherwise, move cursor to just after this session's trailing buffer
    const afterThisWithBuffer = addMinutes(s.end, bufferMin);
    if (afterThisWithBuffer > cursor) cursor = afterThisWithBuffer;

    // If moving the cursor has already exceeded the availability, we can stop early
    if (addMinutes(cursor, durationMin) > windowEnd) return null;
  }

  // If we get here, try placing after the last overlapping session
  if (addMinutes(cursor, durationMin) <= windowEnd) {
    return cursor;
  }

  return null;
}

export default findAvailableSlot;
