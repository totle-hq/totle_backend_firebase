import express from "express";
import { listDepartments } from "../controllers/department.controller.js";

const router = express.Router();

// GET /api/departments
router.get("/departments", listDepartments);

export default router;
