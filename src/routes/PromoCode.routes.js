import express from "express";

// app.js or server.js
import { CreatePromoCode, DeletePromoCode, existingPromoCodes, RedeemPromoCode, searchUsers, UpdatePromoCode, ValidatePromoCode } from "../controllers/PromoCode.Controller.js";

const router = express.Router();
router.get("/", existingPromoCodes);
router.get("/search", searchUsers);
router.post("/", CreatePromoCode);
router.post("/validate", ValidatePromoCode);
router.post("/redeem", RedeemPromoCode);

// PUT /api/promo-codes/:code
router.put("/:code", UpdatePromoCode);

// DELETE /api/promo-codes/:code
router.delete("/:code", DeletePromoCode);

export default router;
