import { SessionAttendance } from "../Models/SessionAttendance.js";
import { Session } from "../Models/SessionModel.js";

export const endSessionAndMarkAttendance = async (req, res) => {
  const { id: user_id } = req.user;
  const { session_id } = req.body;

  try {
    // 1. Mark this user's left_at
    const attendanceRecord = await SessionAttendance.findOne({
      where: { user_id, session_id },
    });

    if (!attendanceRecord) {
      return res.status(404).json({ error: "Attendance record not found." });
    }

    if (!attendanceRecord.left_at) {
      attendanceRecord.left_at = new Date();
      await attendanceRecord.save();
    }

    // 2. Check if both users have left
    const allAttendance = await SessionAttendance.findAll({
      where: { session_id },
    });

    const allUsersLeft = allAttendance.every((record) => record.left_at);

    if (!allUsersLeft) {
      return res
        .status(200)
        .json({ message: "Left time recorded. Waiting for other user." });
    }

    // 3. Finalize attendance for all users
    const session = await Session.findByPk(session_id);
    if (!session) return res.status(404).json({ error: "Session not found." });

    const SESSION_MIN_DURATION_MINUTES = session.duration_minutes;

    for (const record of allAttendance) {
      if (record.status === "present") continue;

      if (!record.joined_at || !record.left_at) {
        record.status = "missed";
      } else {
        const duration =
          (new Date(record.left_at) - new Date(record.joined_at)) / (1000 * 60);
        const requiredDuration = 0.75 * session.duration_minutes;
        record.status =
          duration >= requiredDuration ? "present" : "missed";
      }
      // optional
      if (session.status !== "completed") {
        session.status = "completed";
        session.completed_at = new Date();
        await session.save();
      }

      await record.save();
    }

    return res
      .status(200)
      .json({ message: "Session ended and attendance finalized." });
  } catch (err) {
    console.error("❌ Error in endSessionAndMarkAttendance:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong while ending the session." });
  }
};
