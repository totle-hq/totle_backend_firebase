import express from "express";

import { adminLogin, getAdminDetails } from "../controllers/admin.controller.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";
const router = express.Router();

router.post("/login", loginLimiter, adminLogin);
router.get("/auth/me", getAdminDetails);

export default router;


