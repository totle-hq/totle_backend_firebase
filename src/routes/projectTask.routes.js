// src/routes/projectTask.routes.js
import express from "express";
import multer from "multer";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  deleteFromCloudinary,
} from "../controllers/ProjectControllers/projectTask.controller.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// /api/projects/:boardId/tasks
router.get("/:boardId/tasks", getTasks);
router.post("/:boardId/tasks", upload.array("images"), createTask);

// /api/projects/tasks/:taskId
router.put("/tasks/:taskId", updateTask);
router.delete("/tasks/:taskId", deleteTask);
router.delete("/images/:publicId(*)", deleteFromCloudinary);

export default router;
