// src/controllers/SessionStreamControllers/reassignTeacher.controller.js
import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";

export const reassignTeacher = async (req, res) => {
  try {
    const { sessionId, newTeacherId } = req.body;
    const adminId = req.user?.id || "system";

    if (!sessionId || !newTeacherId) {
      return res.status(400).json({
        success: false,
        message: "sessionId and newTeacherId are required",
      });
    }

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const newTeacher = await User.findByPk(newTeacherId);
    if (!newTeacher || newTeacher.role !== "teacher") {
      return res.status(400).json({ success: false, message: "Invalid teacher ID" });
    }

    session.teacher_id = newTeacherId;
    await session.save();

    console.log(
      `👥 Session ${sessionId} reassigned to ${newTeacher.firstName} by admin ${adminId}`
    );

    return res.status(200).json({
      success: true,
      message: "Teacher reassigned successfully",
    });
  } catch (err) {
    console.error("❌ Error in reassignTeacher:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reassign teacher",
    });
  }
};
