// src/routes/catalogue.routes.js

import express from "express";
import {
    getNodes,
    getNodeById,
    createNode,
    updateNode,
    deleteNode,
    updateDomainPrices,
    updateSubjectPrices,
  } from "../controllers/catalogue.controller.js";
  

const router = express.Router();

/**
 * GET /api/catalogue
 * Fetch all nodes, optionally filtered by parent_id
 */
router.get("/", getNodes);

/**
 * GET /api/catalogue/:node_id
 * Fetch a single node by ID
 */
router.get("/:node_id", getNodeById);

/**
 * POST /api/catalogue
 * Create a new catalogue node
 */
router.post("/", createNode);

/**
 * PUT /api/catalogue/:node_id
 * Update a catalogue node
 */
router.put("/:node_id", updateNode);

/**
 * DELETE /api/catalogue/:node_id
 * Delete a node and its children
 */
router.delete("/:node_id", deleteNode);
/**
 * POST /api/catalogue/:domain_id/update-domain-prices
 */
router.post("/:domain_id/update-domain-prices", updateDomainPrices);

/**
 * POST /api/catalogue/:subject_id/update-subject-prices
 */
router.post("/:subject_id/update-subject-prices", updateSubjectPrices);


export default router;
