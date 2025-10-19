import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";

/**
 * Find the earliest 90-minute window that:
 *   – lies fully inside teacher's available period
 *   – does not overlap any existing sessions
 *   – respects the Bridger 30-min buffer rule if needed
 *
 * @param {Object} params
 * @param {string} params.teacherId
 * @param {Date}   params.availStart   Teacher declared start time (UTC)
 * @param {Date}   params.availEnd     Teacher declared end time (UTC)
 * @param {number} params.durationMin  Session duration (default 90)
 * @param {number} params.bufferMin    Min buffer between sessions (default 30)
 * @returns {Date|null}  start time if found, else null
 */
export async function findAvailableSlot({
  teacherId,
  availStart,
  availEnd,
  durationMin = 90,
  bufferMin = 30,
}) {
  const existing = await Session.findAll({
    where: {
      teacher_id: teacherId,
      status: { [Op.in]: ["available", "booked", "upcoming"] },
      scheduled_at: { [Op.between]: [availStart, availEnd] },
    },
    attributes: ["scheduled_at", "duration_minutes"],
    order: [["scheduled_at", "ASC"]],
    raw: true,
  });

  const sorted = existing.map((s) => ({
    start: new Date(s.scheduled_at),
    end: new Date(new Date(s.scheduled_at).getTime() + s.duration_minutes * 60000),
  }));

  let cursor = new Date(availStart);

  for (const s of sorted) {
    const nextEnd = new Date(cursor.getTime() + durationMin * 60000);
    // enough space before this session?
    if (nextEnd.getTime() + bufferMin * 60000 <= s.start.getTime()) {
      return cursor;
    }
    // move cursor beyond current session + buffer
    cursor = new Date(s.end.getTime() + bufferMin * 60000);
  }

  // try after last existing
  if (cursor.getTime() + durationMin * 60000 <= availEnd.getTime()) {
    return cursor;
  }

  return null;
}
