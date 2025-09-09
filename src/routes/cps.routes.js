import express from "express";
import { updateCpsProfileFromTest } from "../services/cps/cpsEma.service.js";

const router = express.Router();

/**
 * POST /api/cps/apply/:testId
 * Body (optional): { alpha?: number, firstTestSetsBaseline?: boolean }
 */
router.post("/apply/:testId", async (req, res) => {
  try {
    const { testId } = req.params;
    const { alpha, firstTestSetsBaseline } = req.body || {};
    const out = await updateCpsProfileFromTest({
      testId,
      alpha,
      firstTestSetsBaseline,
    });
    res.json(out);
  } catch (err) {
    console.error("[CPS][apply] error:", err);
    res.status(400).json({ error: String(err?.message || err) });
  }
});

export default router;
