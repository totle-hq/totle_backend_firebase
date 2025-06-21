import express from "express";
import {
  getAllEducation,
  getEducationById,
  createEducation,
  updateEducation,
  deleteEducation,
  restoreEducation,
  getEducationByCategory,
} from "../../controllers/CatalogControllers/education.controller.js";

const router = express.Router();

// 🟢 Fetch all education institutions
router.get("/", getAllEducation);

// 🟢 Fetch an education institution by ID
router.get("/:id", getEducationById);

// 🟢 Fetch education institutions by Category ID
router.get("/category/:categoryId", getEducationByCategory);

// 🟢 Create a new education institution
router.post("/", createEducation);

// 🟡 Update an education institution
router.put("/:id", updateEducation);

// 🔴 Soft delete an education institution
router.delete("/:id", deleteEducation);

// ♻ Restore a soft-deleted education institution
router.patch("/restore/:id", restoreEducation);

export default router;
