// File: src/routes/catalogue.routes.js

import express from "express";
import { createNode, deleteNode, getNodes, updateNode } from "../../controllers/CatalogControllers/catalogueNode.controller.js";

const router = express.Router();

router.get("/", getNodes); // <-- Add this at the top


// Create a new catalogue node
router.post("/", createNode);

// Get a node by its ID
// router.get("/:id", getCatalogueNodeById);

// Update a node by ID
router.put("/:id", updateNode);

// Delete a node by ID
router.delete("/:id", deleteNode);

// Get all nodes by type and optional parentId (e.g., /api/catalogue/subject?parentId=xyz)
// router.get("/type/:type", listCatalogueNodesByTypeAndParent);

// Batch update prices at domain level
// router.post("/:domain_id/update-domain-prices", updateDomainPrices);

// Batch update prices at subject level
// router.post("/:subject_id/update-subject-prices", updateSubjectPrices);



export default router;
