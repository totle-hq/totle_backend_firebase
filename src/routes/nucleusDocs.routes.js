import express from "express";
import { authenticateAdmin } from "../middlewares/adminMiddleware.js";

import {
  getDocsTree,
  createFolder,
  createDocument,
  updateDocument,
  moveDocument,
  deleteDoc,
} from "../controllers/nucleusDocs.controller.js";

const router = express.Router();

/**
 * ===============================
 * Nucleus Documentation Routes
 * ===============================
 * All routes:
 * - Nucleus-only
 * - Admin JWT via authenticateAdmin
 * - Permissions enforced inside controllers
 */

// Fetch full documentation tree for a department
// GET /nucleus/docs/tree?department=Manhattan
router.get("/tree", authenticateAdmin, getDocsTree);

// Create a new folder
// POST /nucleus/docs/folder
// body: { name, department_code, parent_id? }
router.post("/folder", authenticateAdmin, createFolder);

// Create a new document
// POST /nucleus/docs/document
// body: { title, content?, folder_id?, department_code }
router.post("/document", authenticateAdmin, createDocument);

// Update document content / title
// PUT /nucleus/docs/document/:id
router.put("/document/:id", authenticateAdmin, updateDocument);

// Move document between folders
// POST /nucleus/docs/move
// body: { document_id, target_folder_id }
router.post("/move", authenticateAdmin, moveDocument);

// Soft delete document
// DELETE /nucleus/docs/:id
router.delete("/:id", authenticateAdmin, deleteDoc);

export default router;
