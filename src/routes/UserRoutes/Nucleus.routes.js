import express from "express";
import { addSyncEmails, changeAccountPassword, createAccountInDepartment, deleteSyncEmail, generateProfileBasedOnRole, getAccountsByDepartmentCode, getAllDepartments, getAllRoles, getAllUsersForRoles, getSyncEmails, sendOtpForProduction, updateSyncEmail, verifyOtpForProduction } from "../../controllers/UserControllers/Nucleus.controller.js";
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
router.post("/sync-email", verifyAdminToken, addSyncEmails);
router.get("/sync-email", verifyAdminToken, getSyncEmails);
router.put("/sync-email/:id", verifyAdminToken, updateSyncEmail);
router.delete("/sync-email/:id", verifyAdminToken, deleteSyncEmail);

export default router;