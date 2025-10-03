import express from "express";
import {
  getFeatures,
  addFeature,
  updateFeature,
  deleteFeature,
  reorderFeatures,
} from "../../controllers/Strategy/featureRoadmap.controller.js";

const router = express.Router();

/* -------------------- Feature Roadmap Routes -------------------- */

// GET all features (ordered by priority)
router.get("/", getFeatures);

// Add a new feature
router.post("/", addFeature);

// Update a feature
router.put("/:id", updateFeature);

// Delete a feature
router.delete("/:id", deleteFeature);

// Reorder features
router.patch("/reorder", reorderFeatures);

export default router;
