// File: src/routes/catalogue.routes.js

import express from "express";
import {
  createCatalogueNode,
  getCatalogueNodeById,
  updateCatalogueNode,
  deleteCatalogueNode,
  listCatalogueNodesByTypeAndParent,
  updateDomainPrices,
  updateSubjectPrices,
    getCatalogueNodes,
} from "../controllers/catalogue.controller.js";

const router = express.Router();

router.get("/", getCatalogueNodes); // <-- Add this at the top


// Create a new catalogue node
router.post("/", createCatalogueNode);

// Get a node by its ID
router.get("/:id", getCatalogueNodeById);

// Update a node by ID
router.put("/:id", updateCatalogueNode);

// Delete a node by ID
router.delete("/:node_id", deleteCatalogueNode);

// Get all nodes by type and optional parentId (e.g., /api/catalogue/subject?parentId=xyz)
router.get("/type/:type", listCatalogueNodesByTypeAndParent);

// Batch update prices at domain level
router.post("/:domain_id/update-domain-prices", updateDomainPrices);

// Batch update prices at subject level
router.post("/:subject_id/update-subject-prices", updateSubjectPrices);



export default router;
