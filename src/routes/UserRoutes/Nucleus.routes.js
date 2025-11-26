import express from "express";
import { addSyncEmails, changeAccountPassword, createAccountInDepartment, deleteInternRoleAccount, deleteSyncEmail, generateProfileBasedOnRole, getAccountsByDepartmentCode, getAllDepartments, getAllRoles, getAllUsersForRoles, getSyncEmails, getTestsWithPaymentMode, sendOtpForProduction, toggleStatusForInterns, updateSyncEmail, updateTestPaymentMode, updateUserDepartmentRolePassword, verifyOtpForProduction } from "../../controllers/UserControllers/Nucleus.controller.js";
import { verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";

const router = express.Router();
router.get("/allDepartments", getAllDepartments);
router.get("/allRoles", getAllRoles);
router.post("/generateProfileBasedOnRole",verifyAdminToken, generateProfileBasedOnRole);
router.get("/getAllProfiles/:departmentId/roles", getAllUsersForRoles);

router.get('/accounts', getAccountsByDepartmentCode); // ?departmentCode=TECH
router.post('/accounts', verifyAdminToken, createAccountInDepartment);
router.patch('/accounts/:id', verifyAdminToken, toggleStatusForInterns);
router.delete('/accounts/:id', verifyAdminToken, deleteInternRoleAccount);
router.patch('/accounts/:id/password',verifyAdminToken, updateUserDepartmentRolePassword);
router.patch('/accounts/password', verifyAdminToken,changeAccountPassword);
router.post('/send-prod-otp', sendOtpForProduction);
router.post('/verify-prod-otp', verifyOtpForProduction);
router.post("/sync-email", verifyAdminToken, addSyncEmails);
router.get("/sync-email", verifyAdminToken, getSyncEmails);
router.put("/sync-email/:id", verifyAdminToken, updateSyncEmail);
router.delete("/sync-email/:id", verifyAdminToken, deleteSyncEmail);
router.get('/tests-with-payment-mode', getTestsWithPaymentMode);
router.post('/update-payment-mode', updateTestPaymentMode);

export default router;