import { FeatureRoadmap } from "../../Models/Strategy/FeatureRoadmap.model.js";
import { Op } from "sequelize";

/* -------------------- Get all features -------------------- */
export const getFeatures = async (req, res) => {
  try {
    const features = await FeatureRoadmap.findAll({
      order: [["priority", "ASC"]],
    });
    res.json(features);
  } catch (error) {
    console.error("❌ Error fetching features:", error);
    res.status(500).json({ message: "Error fetching features" });
  }
};

/* -------------------- Add new feature -------------------- */
export const addFeature = async (req, res) => {
  try {
    const { name, description, addedBy } = req.body;

    // Find max priority and push new one at bottom
    const maxPriority = await FeatureRoadmap.max("priority").catch(() => 0);
    const feature = await FeatureRoadmap.create({
      name,
      description,
      addedBy,
      priority: (isNaN(maxPriority) ? 0 : maxPriority + 1),
      lastModified: new Date(),
    });

    res.status(201).json(feature);
  } catch (error) {
    console.error("❌ Error adding feature:", error);
    res.status(500).json({ message: "Error adding feature" });
  }
};

/* -------------------- Update feature -------------------- */
export const updateFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const feature = await FeatureRoadmap.findByPk(id);
    if (!feature) return res.status(404).json({ message: "Feature not found" });

    feature.name = name ?? feature.name;
    feature.description = description ?? feature.description;
    feature.status = status ?? feature.status;
    feature.lastModified = new Date();

    await feature.save();

    res.json(feature);
  } catch (error) {
    console.error("❌ Error updating feature:", error);
    res.status(500).json({ message: "Error updating feature" });
  }
};

/* -------------------- Delete feature -------------------- */
export const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const feature = await FeatureRoadmap.findByPk(id);
    if (!feature) return res.status(404).json({ message: "Feature not found" });

    await feature.destroy();
    res.json({ message: "✅ Feature deleted" });
  } catch (error) {
    console.error("❌ Error deleting feature:", error);
    res.status(500).json({ message: "Error deleting feature" });
  }
};

/* -------------------- Reorder features -------------------- */
export const reorderFeatures = async (req, res) => {
  try {
    const { orderedIds } = req.body; // array of IDs in new order

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ message: "orderedIds must be an array" });
    }

    // Update priority based on index
    await Promise.all(
      orderedIds.map((id, index) =>
        FeatureRoadmap.update({ priority: index }, { where: { id } })
      )
    );

    res.json({ message: "✅ Priorities updated" });
  } catch (error) {
    console.error("❌ Error reordering features:", error);
    res.status(500).json({ message: "Error reordering features" });
  }
};
