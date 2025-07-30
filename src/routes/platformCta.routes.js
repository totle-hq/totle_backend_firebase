import express from "express";
import { savePlatformCta } from "../controllers/platformCta.Controller.js";

const router = express.Router();

router.post("/platform-cta", savePlatformCta);

export default router;