// src/routes/projectTask.routes.js
import express from "express";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/ProjectControllers/projectTask.controller.js";

const router = express.Router();

// /api/projects/:boardId/tasks
router.get("/:boardId/tasks", getTasks);
router.post("/:boardId/tasks", createTask);

// /api/projects/tasks/:taskId
router.put("/tasks/:taskId", updateTask);
router.delete("/tasks/:taskId", deleteTask);

export default router;
