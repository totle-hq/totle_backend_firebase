// routes/paymentRoutes.js

import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";

import {
  createOrder,
  getBankDetails,
  addOrUpdateBankDetails,
  getTransactionHistory,
  getEarningsTrend,
  getBalanceStats,
  downloadStatement,
} from "../../controllers/PaymentControllers/paymentController.js";

const router = express.Router();

// ---------------- PAYMENT ORDER ----------------
router.post("/orders", authMiddleware, createOrder);

// ---------------- BANK DETAILS ----------------
router.get("/bank/details", authMiddleware, getBankDetails);
router.post("/bank/details", authMiddleware, addOrUpdateBankDetails);

// ---------------- FINANCIAL DATA ----------------
router.get("/transactions", authMiddleware, getTransactionHistory);
router.get("/earnings", authMiddleware, getEarningsTrend);
router.get("/balance", authMiddleware, getBalanceStats);

// ---------------- EXPORT STATEMENT ----------------
router.get("/transactions/export", authMiddleware, downloadStatement);

export default router;
