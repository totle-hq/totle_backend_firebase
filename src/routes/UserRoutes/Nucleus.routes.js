import express from "express";
import { changeAccountPassword, createAccountInDepartment, generateProfileBasedOnRole, getAccountsByDepartmentCode, getAllDepartments, getAllRoles, getAllUsersForRoles } from "../../controllers/UserControllers/Nucleus.controller.js";
import { verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";

const router = express.Router();
router.get("/allDepartments", getAllDepartments);
router.get("/allRoles", getAllRoles);
router.post("/generateProfileBasedOnRole",verifyAdminToken, generateProfileBasedOnRole);
router.get("/getAllProfiles/:departmentId/roles", getAllUsersForRoles);

router.get('/accounts', getAccountsByDepartmentCode); // ?departmentCode=TECH
router.post('/accounts', verifyAdminToken, createAccountInDepartment);
router.patch('/accounts/password', verifyAdminToken,changeAccountPassword);

export default router;