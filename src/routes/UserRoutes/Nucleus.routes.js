import express from "express";
import { addSyncEmails, backfillTestScoresToggleAPI, changeAccountPassword, createAccountInDepartment, deleteInternRoleAccount, deleteSyncEmail, generateProfileBasedOnRole, getAccountsByDepartmentCode, getAllDepartments, getAllRoles, getAllUsersForRoles, getSyncEmails, getTestQuestionDetails, getTestsWithPaymentMode, sendOtpForProduction, testLogsOfUsers, toggleStatusForInterns, updateCatalogueNodePaymentStatus, updateSyncEmail, updateTestPaymentMode, updateUserDepartmentRolePassword, verifyOtpForProduction } from "../../controllers/UserControllers/Nucleus.controller.js";
import { verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";
import { getAllSubscriptions } from "../../controllers/UserControllers/EmailSubscription.Controller.js";

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
router.patch('/update-payment-status/:id', updateCatalogueNodePaymentStatus);
/**
 * @route GET /test-logs
 * @desc Fetch test logs with user/topic/result/date filters
 * @queryParams userName, topicName, resultStatus, dateFrom, dateTo
 */
router.get("/test-logs", testLogsOfUsers);

/**
 * @route POST /backfill-test-scores
 * @desc Backfill score, percentage, and result status
 * @body { dryRun: boolean }
 */
router.post("/backfill-test-scores", backfillTestScoresToggleAPI);

router.get("/test/:test_id/questions", getTestQuestionDetails);
router.get("/subscriptions", getAllSubscriptions);
export default router;