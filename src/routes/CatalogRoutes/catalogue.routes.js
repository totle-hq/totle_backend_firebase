// src/routes/CatalogRoutes/catalogue.routes.js
import express from "express";
import {
  // existing
  createNode, getNodeById, getChildren, updateNode, deleteNode,
  getBreadcrumb, addSubtopics, getSubtopics, updateSubtopic, deleteSubtopic,
  getDomainCount, getTopicCount,

  // NEW
  getDomains,
  getTopicById,
  createTopic,
  updateTopic,
  recomputeTopic,
  getGeneratorInput,
  ingestTopicTelemetry,
  updateDomain,
  recomputeDomainTopics,
  insertNodeBetween,
  deleteAndAdjustNode,
} from "../../controllers/CatalogControllers/catalogueNode.controller.js";

const router = express.Router();

/* -------------------- Existing nodes endpoints -------------------- */
router.post("/nodes", createNode);
router.get("/nodes/:id", getNodeById);
router.get("/nodes", getChildren);          // NOW supports ?is_domain=true or ?type=domain
router.put("/nodes/:id", updateNode);       // still supported for backward compatibility
router.delete("/nodes/:id", deleteNode);
router.get("/breadcrumbs/:id", getBreadcrumb);

/* -------------------- Subtopics (existing) -------------------- */
router.post("/nodes/:id/subtopics", addSubtopics);
router.get("/nodes/:id/subtopics", getSubtopics);
router.put("/nodes/:id/subtopics/:subtopic_id", updateSubtopic);
router.delete("/nodes/:id/subtopics/:subtopic_id", deleteSubtopic);

/* -------------------- Counts (existing) -------------------- */
router.get("/domain-count", getDomainCount);
router.get("/topic-count", getTopicCount);

/* -------------------- CPS-aware: domains -------------------- */
router.get("/domains", getDomains);                  // list ALL domains
router.patch("/domains/:id", updateDomain);          // edit CPS domain priors/mixes/meta
router.post("/domains/:id/recompute", recomputeDomainTopics); // recompute all topics in domain

/* -------------------- CPS-aware: topics -------------------- */
router.get("/topics/:id", getTopicById);             // rich topic read
router.post("/topics", createTopic);                 // create with typed fields + archetype
router.patch("/topics/:id", updateTopic);            // update typed fields; recompute
router.post("/topics/:id/recompute", recomputeTopic);

/* -------------------- Generator + Telemetry -------------------- */
router.get("/generator-input/:topicId", getGeneratorInput);
router.post("/telemetry/topics/:id/ingest", ingestTopicTelemetry);
router.post('/insert-between', insertNodeBetween);
router.delete('/delete-and-adjust/:nodeId', deleteAndAdjustNode);

export default router;
