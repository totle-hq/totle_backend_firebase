import express from "express";
import {
  presignUpload,
  saveMetadata,
  listDocs,
  deleteDoc,
  presignDownload,
} from "../controllers/nucleusDocs.controller.js";

const router = express.Router();

/**
 * ===============================
 * Nucleus Docs Routes (FULL)
 * ===============================
 * All routes are protected — only Founder & Superadmin
 * should be allowed by middleware before hitting here.
 */

// List all documents (metadata only)
router.get("/list", listDocs);

// Generate presigned URL for upload (with file size check)
// Accepts: { fileName, contentType, fileSize, folder? }
router.post("/presign", presignUpload);

// Save metadata after successful upload
// Accepts: { fileName, fileSize, contentType, s3Key, uploadedBy, tags? }
router.post("/upload", saveMetadata);

// Generate presigned URL for secure short-lived download
// NOTE: Path is /presign-download/:id  (NOT /:id/presign-download)
router.get("/presign-download/:id", presignDownload);

// Soft delete document by ID
router.delete("/:id", deleteDoc);

export default router;
