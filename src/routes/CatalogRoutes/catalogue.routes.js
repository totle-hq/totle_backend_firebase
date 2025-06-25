// src/routes/catalogue.routes.js

import express from "express";
import {
  createNode,
  getNodeById,
  getChildren,
  updateNode,
  deleteNode,
  getBreadcrumb,
  addSubtopics,
  getSubtopics,
  updateSubtopic,
  deleteSubtopic,
} from "../../controllers/CatalogControllers/catalogueNode.controller.js";

const router = express.Router();

// 🟢 Create a node
router.post("/nodes", createNode);

// 🟢 Get node by ID
router.get("/nodes/:id", getNodeById);

// 🟢 Get children of a node (parent_id query param)
router.get("/nodes", getChildren);

// 🟡 Update node
router.put("/nodes/:id", updateNode);

// 🔴 Delete node (only if no children)
router.delete("/nodes/:id", deleteNode);

// 🧭 Breadcrumb path to a node
router.get("/breadcrumbs/:id", getBreadcrumb);

router.post("/nodes/:id/subtopics", addSubtopics);

router.get("/nodes/:id/subtopics", getSubtopics);

router.put("/nodes/:id/subtopics/:subtopic_id", updateSubtopic);

router.delete("/nodes/:id/subtopics/:subtopic_id", deleteSubtopic);



export default router;
