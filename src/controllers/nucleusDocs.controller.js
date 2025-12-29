import { NucleusDocFolder } from "../Models/NucleusDocs/NucleusDocFolder.js";
import { NucleusDocument } from "../Models/NucleusDocs/NucleusDocument.js";
import { getAdminContext } from "../utils/getAdminContext.js";
import { canManageDocs } from "../utils/docsPermissions.js";

/**
 * GET /nucleus/docs/tree?department=Manhattan
 */
export async function getDocsTree(req, res) {
  try {
    const { department } = req.query;
    if (!department)
      return res.status(400).json({ error: "department is required" });

    const folders = await NucleusDocFolder.findAll({
      where: { department_code: department, is_deleted: false },
      order: [["order_index", "ASC"]],
    });

    const documents = await NucleusDocument.findAll({
      where: { department_code: department, is_deleted: false },
    });

    return res.json({ folders, documents });
  } catch (err) {
    console.error("DOCS_TREE_ERROR", err);
    return res.status(500).json({ error: "Failed to load documentation tree" });
  }
}

/**
 * POST /nucleus/docs/folder
 * body: { name, department_code, parent_id? }
 */
export async function createFolder(req, res) {
  try {
    const adminContext = await getAdminContext(req.user.id);
    const { name, department_code, parent_id } = req.body;

    if (!canManageDocs(adminContext, department_code)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const folder = await NucleusDocFolder.create({
      name,
      department_code,
      parent_id: parent_id || null,
      created_by: adminContext.adminId,
    });

    return res.status(201).json(folder);
  } catch (err) {
    console.error("CREATE_FOLDER_ERROR", err);
    return res.status(500).json({ error: "Failed to create folder" });
  }
}

/**
 * POST /nucleus/docs/document
 * body: { title, content?, folder_id?, department_code }
 */
export async function createDocument(req, res) {
  try {
    const adminContext = await getAdminContext(req.user.id);
    const { title, content, folder_id, department_code } = req.body;

    if (!canManageDocs(adminContext, department_code)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const doc = await NucleusDocument.create({
      title,
      content: content || "",
      folder_id: folder_id || null,
      department_code,
      created_by: adminContext.adminId,
    });

    return res.status(201).json(doc);
  } catch (err) {
    console.error("CREATE_DOCUMENT_ERROR", err);
    return res.status(500).json({ error: "Failed to create document" });
  }
}

/**
 * PUT /nucleus/docs/document/:id
 */
export async function updateDocument(req, res) {
  try {
    const adminContext = await getAdminContext(req.user.id);
    const { id } = req.params;
    const { title, content } = req.body;

    const doc = await NucleusDocument.findByPk(id);
    if (!doc || doc.is_deleted) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!canManageDocs(adminContext, doc.department_code)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    await doc.update({
      title: title ?? doc.title,
      content: content ?? doc.content,
      updated_by: adminContext.adminId,
    });

    return res.json(doc);
  } catch (err) {
    console.error("UPDATE_DOCUMENT_ERROR", err);
    return res.status(500).json({ error: "Failed to update document" });
  }
}

/**
 * POST /nucleus/docs/move
 * body: { document_id, target_folder_id }
 */
export async function moveDocument(req, res) {
  try {
    const adminContext = await getAdminContext(req.user.id);
    const { document_id, target_folder_id } = req.body;

    const doc = await NucleusDocument.findByPk(document_id);
    if (!doc || doc.is_deleted) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!canManageDocs(adminContext, doc.department_code)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    await doc.update({
      folder_id: target_folder_id,
      updated_by: adminContext.adminId,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("MOVE_DOCUMENT_ERROR", err);
    return res.status(500).json({ error: "Failed to move document" });
  }
}

/**
 * DELETE /nucleus/docs/:id
 * Soft delete
 */
export async function deleteDoc(req, res) {
  try {
    const adminContext = await getAdminContext(req.user.id);
    const { id } = req.params;

    const doc = await NucleusDocument.findByPk(id);
    if (!doc || doc.is_deleted) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!canManageDocs(adminContext, doc.department_code)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    await doc.update({
      is_deleted: true,
      updated_by: adminContext.adminId,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE_DOCUMENT_ERROR", err);
    return res.status(500).json({ error: "Failed to delete document" });
  }
}
