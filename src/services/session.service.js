import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";

const MIN_GAP_MIN_FOR_BRIDGER = 30;

/**
 * Ensures a teacher’s sessions don’t overlap and maintain the minimum buffer.
 * - Skips the slot being used as a base (excludeSessionId)
 * - Ignores sessions with identical start/end as proposed
 */
export async function assertTeacherBuffer({
  teacherId,
  startAt,
  durationMinutes,
  level,
  excludeSessionId,
}) {
  if ((level || "Bridger") !== "Bridger") return;

  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  // Scan ±3h for this teacher’s nearby sessions
  const windowStart = new Date(start.getTime() - 3 * 60 * 60000);
  const windowEnd = new Date(end.getTime() + 3 * 60 * 60000);

  const where = {
    teacher_id: teacherId,
    status: { [Op.in]: ["available", "booked", "upcoming"] },
    scheduled_at: { [Op.between]: [windowStart, windowEnd] },
  };

  const rows = await Session.findAll({
    where,
    attributes: ["session_id", "topic_id", "scheduled_at", "duration_minutes"],
  });

  for (const r of rows) {
    // Skip same session
    if (excludeSessionId && r.session_id === excludeSessionId) continue;

    const s = new Date(r.scheduled_at);
    const e = new Date(s.getTime() + r.duration_minutes * 60000);

    // ✅ Skip sessions with identical start/end to the proposed slot
    if (s.getTime() === start.getTime() && e.getTime() === end.getTime()) continue;

    // ❌ Overlap
    const overlaps = s < end && start < e;
    if (overlaps) {
      throw new Error("Overlaps another session for this teacher.");
    }

    // ✅ Bridger 30-min buffer
    const gapAfterPrev = (start.getTime() - e.getTime()) / 60000;
    const gapBeforeNext = (s.getTime() - end.getTime()) / 60000;

    if (gapAfterPrev > -1 && gapAfterPrev < MIN_GAP_MIN_FOR_BRIDGER) {
      throw new Error("Needs a 30-minute buffer after the previous session.");
    }
    if (gapBeforeNext > -1 && gapBeforeNext < MIN_GAP_MIN_FOR_BRIDGER) {
      throw new Error("Needs a 30-minute buffer before the next session.");
    }
  }
}
