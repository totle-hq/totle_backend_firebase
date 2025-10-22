import express from "express";
import { changeAccountPassword, createAccountInDepartment, generateProfileBasedOnRole, getAccountsByDepartmentCode, getAllDepartments, getAllRoles, getAllUsersForRoles, sendOtpForProduction, verifyOtpForProduction } from "../../controllers/UserControllers/Nucleus.controller.js";
import { verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";

const router = express.Router();
router.get("/allDepartments", getAllDepartments);
router.get("/allRoles", getAllRoles);
router.post("/generateProfileBasedOnRole",verifyAdminToken, generateProfileBasedOnRole);
router.get("/getAllProfiles/:departmentId/roles", getAllUsersForRoles);

router.get('/accounts', getAccountsByDepartmentCode); // ?departmentCode=TECH
router.post('/accounts', verifyAdminToken, createAccountInDepartment);
router.patch('/accounts/password', verifyAdminToken,changeAccountPassword);
router.post('/send-prod-otp', sendOtpForProduction);
router.post('/verify-prod-otp', verifyOtpForProduction);

export default router;