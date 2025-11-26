import express from "express";
import { addOrUpdateBankDetails, downloadStatement, getBalanceStats, getBankDetails, getEarningsTrend, getTransactionHistory } from "../../controllers/PaymentControllers/paymentController";

const router = express.Router();

router.get('/bank-details/:userId', getBankDetails);
router.post('/bank-details', addOrUpdateBankDetails);

router.get('/transactions/:userId', getTransactionHistory);
router.get('/earnings/:userId', getEarningsTrend);
router.get('/balance/:userId', getBalanceStats);

router.get('/transactions/:userId/export', downloadStatement);