import express from "express";
import { generateProfileBasedOnRole, getAllDepartments, getAllRoles, getAllUsersForRoles } from "../../controllers/UserControllers/Nucleus.controller.js";
import { verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";

const router = express.Router();
router.get("/allDepartments", getAllDepartments);
router.get("/allRoles", getAllRoles);
router.post("/generateProfileBasedOnRole",verifyAdminToken, generateProfileBasedOnRole);
router.get("/getAllProfiles/:departmentId/roles", getAllUsersForRoles);

export default router;