import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";
import { getPaidTeachersWithAvailability } from "../../controllers/PiadTeacher.controller.js";

const router = express.Router();

router.get("/:topicId/paid-teachers", authMiddleware, getPaidTeachersWithAvailability);

export default router;