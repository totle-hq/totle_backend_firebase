import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";
import { getDomains, getLanguageDemand, getPaidETA, getSearchTopics, getSummary, getTeacherStats, getTopActiveDomains, getTopActiveTopics, getTopEntities, getTrendData, upgradeToPaid } from "../../controllers/MarketplaceControllers/marketplace.controller.js";

const router=express.Router();

router.get("/topsearch",authMiddleware,getSearchTopics);
router.get("/activetopics",authMiddleware,getTopActiveTopics);
router.get("/activedomain",authMiddleware,getTopActiveDomains);
router.post("/upgrade",upgradeToPaid);
router.get('/top', getTopEntities);

// Trend data
router.get('/trend', getTrendData);

// Summary statistics
router.get('/summary', getSummary);

// Teacher statistics
router.get('/teachers', getTeacherStats);

// Paid eligibility ETA
router.get('/etaPaid', getPaidETA);



// Language demand
router.get('/languageDemand', getLanguageDemand);
router.get("/domain",getDomains)

export default router;