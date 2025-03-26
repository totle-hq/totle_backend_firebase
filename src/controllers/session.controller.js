// import express from "express";
// import { v4 as uuidv4 } from "uuid";
// import { userDb } from "../config/prismaClient.js";

// const router = express.Router();

// // ✅ Create a new session
// export const createSession = async (req, res) => {
//   try {
//     const { teacherId, learnerId } = req.body;

//     if (!teacherId || !learnerId) {
//       return res.status(400).json({ error: "Teacher and Learner are required." });
//     }

//     // Prevent duplicate active/scheduled sessions
//     const existingSession = await userDb.session.findFirst({
//       where: {
//         teacherId,
//         learnerId,
//         status: { in: ["scheduled", "active"] },
//       },
//     });

//     if (existingSession) {
//       return res.status(400).json({ error: "An active session already exists." });
//     }

//     const roomName = `Room-${uuidv4()}`;

//     const session = await userDb.session.create({
//       data: { roomName, teacherId, learnerId },
//     });

//     res.status(201).json({ message: "Session created", session });
//   } catch (error) {
//     console.error("Error creating session:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ✅ Fetch session details
// export const sessionDetails = async (req, res) => {
//   try {
//     const session = await userDb.session.findUnique({
//       where: { id: req.params.sessionId },
//       include: { teacher: true, learner: true },
//     });

//     if (!session) return res.status(404).json({ error: "Session not found" });

//     res.status(200).json({ session });
//   } catch (error) {
//     console.error("Error fetching session:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ✅ Mark session as "active"
// export const activeSession= async (req, res) => {
//   try {
//     const session = await userDb.session.update({
//       where: { id: req.params.sessionId },
//       data: { status: "active" },
//     });

//     res.status(200).json({ message: "Session started", session });
//   } catch (error) {
//     console.error("Error starting session:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ✅ Mark session as "completed"
// export const completedSession = async (req, res) => {
//   try {
//     const session = await userDb.session.update({
//       where: { id: req.params.sessionId },
//       data: { status: "completed" },
//     });

//     res.status(200).json({ message: "Session marked as completed", session });
//   } catch (error) {
//     console.error("Error completing session:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

