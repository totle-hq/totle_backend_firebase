import express from "express";

// app.js or server.js
import { CreatePromoCode, DeletePromoCode, existingPromoCodes, RedeemPromoCode, searchUsers, togglePromo, UpdatePromoCode, ValidatePromoCode } from "../controllers/PromoCodeController/PromoCodeController.js";

const router = express.Router();
router.get("/", existingPromoCodes);
router.get("/search", searchUsers);
router.post("/", CreatePromoCode);
router.post("/validate", ValidatePromoCode);
router.post("/redeem", RedeemPromoCode);

// PUT /api/promo-codes/:code
router.put("/:code", UpdatePromoCode);
router.patch("/:id", togglePromo)
// DELETE /api/promo-codes/:code
router.delete("/:code", DeletePromoCode);

export default router;