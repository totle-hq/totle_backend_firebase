import { KnowledgeQueue } from "../../Models/CatalogModels/KnowledgeQueue.model.js";
import { Op } from "sequelize";

/* ---------------- GET all ---------------- */
export const getKnowledgeQueue = async (req, res) => {
  try {
    const rows = await KnowledgeQueue.findAll({
      order: [["position", "ASC"], ["createdAt", "ASC"]],
    });
    res.json(rows);
  } catch (err) {
    console.error("❌ getKnowledgeQueue error:", err);
    res.status(500).json({ error: "Failed to fetch knowledge queue" });
  }
};

/* ---------------- CREATE ---------------- */
export const createKnowledgeQueue = async (req, res) => {
  try {
    const { name, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    // compute position = last + 1
    const max = await KnowledgeQueue.max("position");
    const nextPos = (max || 0) + 1;

    const row = await KnowledgeQueue.create({
      name,
      notes,
      position: nextPos,
      createdBy: req.user?.id || null,
    });

    res.json(row);
  } catch (err) {
    console.error("❌ createKnowledgeQueue error:", err);
    res.status(500).json({ error: "Failed to create knowledge queue entry" });
  }
};

/* ---------------- UPDATE ---------------- */
export const updateKnowledgeQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, notes } = req.body;

    const row = await KnowledgeQueue.findByPk(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    row.name = name ?? row.name;
    row.notes = notes ?? row.notes;
    row.updatedBy = req.user?.id || null;

    await row.save();
    res.json(row);
  } catch (err) {
    console.error("❌ updateKnowledgeQueue error:", err);
    res.status(500).json({ error: "Failed to update entry" });
  }
};

/* ---------------- DELETE ---------------- */
export const deleteKnowledgeQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await KnowledgeQueue.findByPk(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    await row.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ deleteKnowledgeQueue error:", err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
};

/* ---------------- REORDER ---------------- */
export const reorderKnowledgeQueue = async (req, res) => {
  try {
    const { ids } = req.body; 
    // ids = [{id, position}, ...]
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "Invalid ids array" });
    }

    const updates = ids.map((x) =>
      KnowledgeQueue.update(
        { position: x.position },
        { where: { id: x.id } }
      )
    );
    await Promise.all(updates);

    const refreshed = await KnowledgeQueue.findAll({
      order: [["position", "ASC"], ["createdAt", "ASC"]],
    });

    res.json(refreshed);
  } catch (err) {
    console.error("❌ reorderKnowledgeQueue error:", err);
    res.status(500).json({ error: "Failed to reorder" });
  }
};
