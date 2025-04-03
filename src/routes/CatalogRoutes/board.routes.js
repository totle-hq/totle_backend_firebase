import express from "express";
import {
  getAllBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
  restoreBoard,
  getBoardsByEducation,
} from "../../controllers/CatalogControllers/board.controller.js";

const router = express.Router();

// 🟢 Fetch all boards
router.get("/", getAllBoards);

// 🟢 Fetch a board by ID
router.get("/:id", getBoardById);

// 🟢 Fetch boards by Education ID
router.get("/education/:eduId", getBoardsByEducation);

// 🟢 Create a new board
router.post("/", createBoard);

// 🟡 Update a board
router.put("/:id", updateBoard);

// 🔴 Soft delete a board
router.delete("/:id", deleteBoard);

// ♻ Restore a soft-deleted board
router.patch("/restore/:id", restoreBoard);

export default router;
