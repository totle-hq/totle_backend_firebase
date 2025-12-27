// src/routes/promoCode.routes.js
import express from "express";
import { PromoCode } from "../Models/PromoCodes/PromoCode.Model.js";
import { PromoCodeRedemption } from "../Models/PromoCodes/PromoCodeRedemption.Model.js";
import { generatePromoCode } from "../utils/GeneratePromoCode.js";
import { User } from "../Models/UserModels/UserModel.js";
import { Op } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

const router = express.Router();


/**
 * CREATE PROMO CODE
 */

export const CreatePromoCode = async (req, res) => {
  try {
    const {
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

    const code = generatePromoCode();

    const promo = await PromoCode.create({
      code,
      discount,
      type,
      usage_limit,
      expires_at,
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
      return res.status(409).json({ error: "Promo already used by user" });

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
      return res.status(409).json({ error: "Promo already redeemed by user" });
    }

    console.error("Redemption failed:", err);
    res.status(500).json({ error: "Redemption failed" });
  }
};

export const existingPromoCodes = async (req, res) => {
  try {
    const all = await PromoCode.findAll({ order: [["createdAt", "DESC"]] });
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

    await promo.update(req.body);
    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
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
    await promo.update({
      is_voided: true,
      is_active: false, // optional but recommended
    });

    res.json({
      success: true,
      message: "Promo code voided successfully",
    });
  } catch (err) {
    console.error("Void promo failed:", err);
    res.status(500).json({ error: "Void failed" });
  }
};


export default router;
