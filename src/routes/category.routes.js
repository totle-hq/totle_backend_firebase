import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from "../controllers/CatalogControllers/category.controller.js";

const router = express.Router();

// 🟢 Fetch all categories
router.get("/", getAllCategories);

// 🟢 Fetch a category by ID
router.get("/:id", getCategoryById);

// 🟢 Create a new category
router.post("/", createCategory);

// 🟡 Update a category
router.put("/:id", updateCategory);

// 🔴 Soft delete a category
router.delete("/:id", deleteCategory);

// ♻ Restore a soft-deleted category
router.patch("/restore/:id", restoreCategory);

export default router;
