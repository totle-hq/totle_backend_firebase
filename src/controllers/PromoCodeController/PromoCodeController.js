// src/routes/promoCode.routes.js
import express from "express";
import { Op } from "sequelize";
import { PromoCode } from "../../Models/PromoCodeModels/PromoCode.Model.js";
import { PromoCodeRedemption } from "../../Models/PromoCodeModels/PromoCodeRedemption.Model.js";
import { generatePromoCode } from "../../utils/GeneratePromoCode.js";

const router = express.Router();


/**
 * CREATE PROMO CODE
 */

export const CreatePromoCode = async (req, res) => {
  try {
    const {
      code,
      discount,
      type,
      usage_limit,
      expires_at,
      audience = "all",
      user_id = null,
      min_order_value = null,
      is_stackable = false,
      tags = [],
    } = req.body;

    const finalCode = (code || generatePromoCode()).toUpperCase();
    
    const existing = await PromoCode.findOne({ where: { code: finalCode } });
    if (existing) {
      return res.status(409).json({ error: "Promo code already exists" });
    }

    // -------- SAFE VALIDATION --------
    let safeDiscount = Number(discount);

    if (!safeDiscount || isNaN(safeDiscount)) {
      return res.status(400).json({ error: "Invalid discount value" });
    }

    if (!["percentage", "amount"].includes(type)) {
      return res.status(400).json({ error: "Invalid promo type" });
    }

    // % discount rules
    if (type === "percentage") {
      if (safeDiscount < 1 || safeDiscount > 98) {
        return res.status(400).json({
          error: "Percentage discount must be between 1 and 98",
        });
      }
      safeDiscount = Math.round(safeDiscount);
    }

    // ₹ discount rules
    if (type === "amount") {
      if (safeDiscount < 1) {
        return res.status(400).json({
          error: "Flat discount must be at least ₹1",
        });
      }

      // Hard safety cap (anti-mistake / anti-abuse)
      if (safeDiscount > 100000) { // ₹1 lakh cap
        return res.status(400).json({
          error: "Flat discount is too large",
        });
      }

      safeDiscount = Math.ceil(safeDiscount);
    }

    // Min order validation
    if (min_order_value !== null && Number(min_order_value) < 1) {
      return res.status(400).json({
        error: "Minimum order value must be at least ₹1",
      });
    }

    // Usage limit validation
    if (usage_limit !== null && usage_limit < 1) {
      return res.status(400).json({
        error: "Usage limit must be at least 1",
      });
    }
    // Validate expiry date
    let safeExpiry = null;

    if (expires_at === "" || expires_at === undefined || expires_at === null) {
      safeExpiry = null;
    } 
    else {
      const expiry = new Date(expires_at);

      if (isNaN(expiry.getTime())) {
        return res.status(400).json({ error: "Invalid expiry date format" });
      }

      if (expiry <= new Date()) {
        return res.status(400).json({ error: "Expiry date must be in the future" });
      }

      safeExpiry = expiry;
    }

    const promo = await PromoCode.create({
      code: finalCode,
      discount: safeDiscount,
      type,
      usage_limit,
      expires_at: safeExpiry,
      audience,
      user_id,
      min_order_value,
      is_stackable,
      tags,
    });
    
    res.status(201).json(promo);
  } catch (err) {
    console.error("Promo creation failed:", err);
    res.status(500).json({ error: "Failed to create promo code" });
  }
};

/**
 * VALIDATE PROMO CODE
 */  
export const ValidatePromoCode = async (req, res) => {
  try {
    const { code, user_id, user_role, order_value, is_first_purchase } = req.body;

    const promo = await PromoCode.findByPk(code);

    if (!promo || !promo.is_active)
      return res.status(404).json({ error: "Invalid promo code" });

    if (promo.expires_at && new Date() > promo.expires_at)
      return res.status(410).json({ error: "Promo code expired" });

    if (promo.used_count >= promo.usage_limit)
      return res.status(429).json({ error: "Promo usage limit reached" });

    if (promo.audience !== "all" && promo.audience !== user_role)
      return res.status(403).json({ error: "Promo not applicable for this role" });

    if (promo.user_id && promo.user_id !== user_id)
      return res.status(403).json({ error: "Promo not assigned to this user" });

    if (promo.min_order_value && order_value < promo.min_order_value)
      return res.status(400).json({ error: "Order value too low for this promo" });

    // check per-user redemption
    const alreadyUsed = await PromoCodeRedemption.findOne({
      where: { promo_code: code, user_id },
    });

    if (alreadyUsed)
      return res.status(409).json({ error: "Promocode already used by user" });

    res.json({
      valid: true,
      discount: promo.discount,
      type: promo.type,
    });
  } catch (err) {
    console.error("Validation failed:", err);
    res.status(500).json({ error: "Validation error" });
  }
};


/**
 * REDEEM PROMO CODE
 */
export const RedeemPromoCode = async (req, res) => {
  const transaction = await PromoCode.sequelize.transaction();

  try {
    const { code, user_id } = req.body;

    const promo = await PromoCode.findByPk(code, { transaction });

    if (!promo) {
      await transaction.rollback();
      return res.status(404).json({ error: "Invalid promo code" });
    }

    // create redemption record
    await PromoCodeRedemption.create(
      {
        promo_code: code,
        user_id,
      },
      { transaction }
    );

    promo.used_count += 1;
    await promo.save({ transaction });

    await transaction.commit();

    res.json({ success: true });
  } catch (err) {
    await transaction.rollback();

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Promocode already redeemed by user" });
    }

    console.error("Redemption failed:", err);
    res.status(500).json({ error: "Redemption failed" });
  }
};

export const existingPromoCodes = async (req, res) => {
  try {
    const now = new Date();

    const all = await PromoCode.findAll({
      where: {
        // [Op.or]: [
        //   { expires_at: null },                   // Never expires
        //   { expires_at: { [Op.gt]: now } },       // Expires in the future
        // ],
        // is_active: true,                          // Optional: only active promos
      },
      order: [["createdAt", "DESC"]],
    });

    res.json(all);
  } catch {
    res.status(500).json({ error: "Failed to load promo codes" });
  }
};

/**
 * GET ALL PROMO CODES WITH USERS
 */

export const getAllPromoCodes = async (req, res) => {
  const { search } = req.query;

  try {
    const promos = await PromoCode.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
          where: search
            ? {
                [Op.or]: [
                  { id: { [Op.iLike]: `%${search}%` } },
                  { firstName: { [Op.iLike]: `%${search}%` } },
                  { lastName: { [Op.iLike]: `%${search}%` } },
                ],
              }
            : undefined,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(promos);
  } catch (err) {
    console.error("Failed to fetch promo codes:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// GET /api/promo-codes/search?query=...
export const searchUsers = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.json([]);
  }

  try {
    const users = await User.findAll({
      where: {
        [Op.or]: [
          // ✅ CAST UUID → TEXT
          sequelize1.where(
            sequelize1.cast(sequelize1.col("User.id"), "text"),
            {
              [Op.iLike]: `%${query}%`,
            }
          ),
          { firstName: { [Op.iLike]: `%${query}%` } },
          { lastName: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: ["id", "firstName", "lastName"],
      limit: 10,
    });

    res.json(users);
  } catch (err) {
    console.error("User search failed:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
};



export const UpdatePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByPk(req.params.code);
    if (!promo) return res.status(404).json({ error: "Promo not found" });
    console.dir(req.body);

    await promo.update(req.body);
    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
};

export const togglePromo = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const promo = await PromoCode.findByPk(id);
    if (!promo) return res.status(404).json({ error: "Promo not found" });

    promo.is_active = is_active;
    await promo.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update promo status" });
  }
};



export const DeletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      where: { code: req.params.code },
    });

    if (!promo) {
      return res.status(404).json({ error: "Promo code not found" });
    }

    // Soft delete (VOID)
    await promo.destroy();

    res.json({
      success: true,
      message: "Promo code deleted successfully",
    });
  } catch (err) {
    console.error("Promo deletion failed:", err);
    res.status(500).json({ error: "Deletion failed" });
  }
};


export default router;