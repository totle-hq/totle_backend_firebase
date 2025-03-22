import express from "express";
import {
  getAllGrades,
  getGradeById,
  createGrade,
  updateGrade,
  deleteGrade,
  restoreGrade,
  getGradesByBoard,
} from "../controllers/CatalogControllers/grade.controller.js";

const router = express.Router();

// 🟢 Fetch all grades
router.get("/", getAllGrades);

// 🟢 Fetch a grade by ID
router.get("/:id", getGradeById);

// 🟢 Fetch grades by Board ID
router.get("/board/:boardId", getGradesByBoard);

// 🟢 Create a new grade
router.post("/", createGrade);

// 🟡 Update a grade
router.put("/:id", updateGrade);

// 🔴 Soft delete a grade
router.delete("/:id", deleteGrade);

// ♻ Restore a soft-deleted grade
router.patch("/restore/:id", restoreGrade);

export default router;
