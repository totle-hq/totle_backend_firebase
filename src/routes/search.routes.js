import express from "express";
import { searchCatalogue } from "../controllers/search.controller.js";


const router = express.Router();

// Search endpoint
router.get("/", searchCatalogue);

export default router;
