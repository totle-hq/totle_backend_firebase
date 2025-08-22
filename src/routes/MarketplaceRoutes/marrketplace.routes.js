import express from "express";
import { getDomains, getLanguageDemand, getPaidETA, getReverseMappingLoad, getSummary, getTeacherStats, getTopEntities, getTrendData, upgradeToPaid } from "../../controllers/MarketplaceControllers/marketplace.controller.js";

const router=express.Router();


router.post("/upgrade",upgradeToPaid);
router.get('/top',getTopEntities);
router.get('/trend', getTrendData);
router.get('/summary',getSummary);
router.get('/teachers',getTeacherStats);
router.get('/etaPaid', getPaidETA);
router.get("/reverseLoad",getReverseMappingLoad);
router.get('/languageDemand', getLanguageDemand);
router.get("/domain",getDomains);

export default router;