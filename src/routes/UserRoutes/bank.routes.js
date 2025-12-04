import express from "express";
import {
  getBankDetails,
  addOrUpdateBankDetails,
} from "../../controllers/PaymentControllers/paymentController.js";
import authMiddleware from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use((req, _res, next) => {
  console.log("BANK ROUTE HIT:", req.method, req.originalUrl);
  next();
});

router.get("/details", authMiddleware, getBankDetails);
router.post("/details", authMiddleware, addOrUpdateBankDetails);

export default router;
