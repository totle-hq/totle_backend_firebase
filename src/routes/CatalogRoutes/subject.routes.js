import express from "express";
import {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  restoreSubject,
  getSubjectsByGrade,
} from "../../controllers/CatalogControllers/subject.controller.js";

const router = express.Router();

// 🟢 Fetch all subjects
router.get("/", getAllSubjects);

// 🟢 Fetch a subject by ID
router.get("/:id", getSubjectById);

// 🟢 Fetch subjects by Grade ID
router.get("/grade/:gradeId", getSubjectsByGrade);

// 🟢 Create a new subject
router.post("/", createSubject);

// 🟡 Update a subject
router.put("/:id", updateSubject);

// 🔴 Soft delete a subject
router.delete("/:id", deleteSubject);

// ♻ Restore a soft-deleted subject
router.patch("/restore/:id", restoreSubject);

export default router;
