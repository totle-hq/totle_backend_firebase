// src/routes/projectBoard.routes.js
import express from "express";
import {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
} from "../controllers/ProjectControllers/projectBoard.controller.js";

const router = express.Router();

// /api/projects/boards
router.get("/boards", getBoards);
router.post("/boards", createBoard);
router.put("/boards/:id", updateBoard);
router.delete("/boards/:id", deleteBoard);

export default router;
