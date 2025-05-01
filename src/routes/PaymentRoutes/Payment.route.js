// routes/paymentRoutes.js

import express from "express";
import { createOrder } from "../../controllers/PaymentControllers/paymentController.js";

const router = express.Router();

// POST /api/payment/orders
router.post("/orders", createOrder);

export default router;
