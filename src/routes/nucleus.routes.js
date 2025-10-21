// routes/admin.routes.js
import express from "express";
import { getAllUserDetails , nucleusSessionDetails, setUserBlacklistOrActive } from "../controllers/nucleus.controller.js";

const router = express.Router();

// Admin route to get personal info of a user
router.get("/user/info", getAllUserDetails);
router.patch("/user/status",setUserBlacklistOrActive);
router.get("/sessions", nucleusSessionDetails);
export default router;
