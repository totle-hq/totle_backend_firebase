// src/controllers/SessionStreamControllers/getAllSessions.controller.js
import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { Op } from "sequelize";

export const getAllSessions = async (req, res) => {
  try {
    const now = new Date();

    const sessions = await Session.findAll({
      include: [
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: CatalogueNode,
          as: "topic",
          attributes: ["name", "parent_id"],
          include: [
            {
              model: CatalogueNode,
              as: "subject",
              attributes: ["name"],
            },
          ],
        },
      ],
      order: [["scheduled_at", "ASC"]],
    });

    const formatted = sessions.map((s) => ({
      session_id: s.session_id,
      topicName: s.topic?.name || "Unknown",
      studentName: s.student
        ? `${s.student.firstName} ${s.student.lastName || ""}`
        : "Unassigned",
      teacherName: s.teacher
        ? `${s.teacher.firstName} ${s.teacher.lastName || ""}`
        : "Unassigned",
      scheduled_at: s.scheduled_at,
      completed_at: s.completed_at,
      status: s.status || "unknown",
    }));

    return res.status(200).json({ success: true, sessions: formatted });
  } catch (err) {
    console.error("❌ Error in getAllSessions:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions",
    });
  }
};
