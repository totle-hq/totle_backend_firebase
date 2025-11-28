import express from "express";
import { addOrUpdateBankDetails, downloadStatement, getBalanceStats, getBankDetails, getEarningsTrend, getTransactionHistory } from "../../controllers/PaymentControllers/paymentController.js";
import authMiddleware from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get('/get/bank-details', getBankDetails);
router.post('/add/bank-details', addOrUpdateBankDetails);

router.get('/transactions/:userId', getTransactionHistory);
router.get('/earnings/:userId', getEarningsTrend);
router.get('/balance/:userId', getBalanceStats);

router.get('/transactions/:userId/export', downloadStatement);
export default router;