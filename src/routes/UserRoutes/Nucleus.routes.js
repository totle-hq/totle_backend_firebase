import express from "express";
import { generateProfileBasedOnRole, getAllDepartments, getAllRoles, getAllUsersForRoles } from "../../controllers/UserControllers/Nucleus.controller.js";

const router = express.Router();
router.get("/allDepartments", getAllDepartments);
router.get("/allRoles", getAllRoles);
router.post("/generateProfileBasedOnRole", generateProfileBasedOnRole);
router.get("/getAllProfiles", getAllUsersForRoles);

export default router;