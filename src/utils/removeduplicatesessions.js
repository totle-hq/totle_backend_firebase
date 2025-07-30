import { Session } from "../models";
import { Op } from "sequelize";

export const deduplicateSessions = async (sessionId) => {
  try {
    // 1. Get the booked session
    const session = await Session.findByPk(sessionId);

    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return 0;
    }

    const { teacher_id, scheduled_at, completed_at } = session;

    // 2. Delete other "available" sessions with same time
    const deletedCount = await Session.destroy({
      where: {
        teacher_id,
        scheduled_at,
        completed_at,
        status: "available",
        id: { [Op.ne]: sessionId }, // don't delete the one just booked
      },
    });

    console.log(`Deleted ${deletedCount} conflicting slots for teacher ${teacher_id}`);
    return deletedCount;

  } catch (err) {
    console.error("deduplicateSessions error:", err);
    return 0;
  }
};

