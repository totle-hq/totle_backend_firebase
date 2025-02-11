import express from "express";
import { getLanguages, insertLanguages } from "../controllers/language.controller.js";

const router = express.Router();

router.get("/", getLanguages); // ✅ Fetch available languages
router.post("/", insertLanguages); // ✅ Add new language (admin use)

export default router;
