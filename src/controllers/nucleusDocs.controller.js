import NucleusDocs from "../Models/NucleusDocs.js";
import { getUploadUrl, getDownloadUrl } from "../services/s3Service.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// sanitize a folder prefix: collapse slashes, remove leading/trailing slashes
function cleanFolder(raw = "") {
  const s = String(raw || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  return s;
}

// 1. Generate presigned URL for upload
export async function presignUpload(req, res) {
  try {
    const { fileName, contentType, fileSize, folder } = req.body;
    if (!fileName || !contentType || !fileSize) {
      return res
        .status(400)
        .json({ error: "Missing fileName, contentType or fileSize" });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      });
    }

    // Optional folder prefix inside "nucleus-docs/"
    const folderPart = cleanFolder(folder);
    const basePrefix = "nucleus-docs";
    const prefix = folderPart ? `${basePrefix}/${folderPart}` : basePrefix;

    // Put a time prefix for easy sorting/uniqueness
    const key = `${prefix}/${Date.now()}-${encodeURIComponent(fileName)}`;
    const uploadUrl = await getUploadUrl(key, contentType);

    return res.json({ uploadUrl, key });
  } catch (err) {
    console.error("presignUpload error:", err);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
}

// 2. Save metadata after upload
export async function saveMetadata(req, res) {
  try {
    const {
      fileName,
      fileSize,
      contentType,
      s3Key,
      uploadedBy,
      tags = [],
    } = req.body;

    if (!fileName || !fileSize || !contentType || !s3Key || !uploadedBy) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const doc = await NucleusDocs.create({
      fileName,
      fileSize,
      contentType,
      s3Key,
      uploadedBy,
      tags,
      uploadedAt: new Date(),
    });

    res.json(doc);
  } catch (err) {
    console.error("saveMetadata error:", err);
    res.status(500).json({ error: "Failed to save metadata" });
  }
}

// 3. List documents
export async function listDocs(req, res) {
  try {
    const docs = await NucleusDocs.findAll({
      order: [["uploadedAt", "DESC"]],
    });
    res.json(docs);
  } catch (err) {
    console.error("listDocs error:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
}

// 4. Delete document (soft delete with paranoid:true)
export async function deleteDoc(req, res) {
  try {
    const { id } = req.params;
    const doc = await NucleusDocs.findByPk(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    await doc.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error("deleteDoc error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
}

// 5. Generate presigned URL for download
export async function presignDownload(req, res) {
  try {
    const { id } = req.params;
    const doc = await NucleusDocs.findByPk(id);
    if (!doc || !doc.s3Key) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Expiry set to 5 minutes (300s)
    const downloadUrl = await getDownloadUrl(doc.s3Key, 300);

    res.json({ downloadUrl });
  } catch (err) {
    console.error("presignDownload error:", err);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
}
