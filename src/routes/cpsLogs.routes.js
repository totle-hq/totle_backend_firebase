import { Router } from "express";

const router = Router();

/**
 * Query params supported (forward-compatible):
 *  - limit (default 50), cursor, testKind, status, pipeline, q, from, to
 */

// Unified endpoint — return empty shape for now to unblock UI
router.get("/observatory", async (req, res) => {
  return res.json({ items: [], nextCursor: null });
});

// Fallback endpoints — return empty arrays for now
router.get("/generation", async (req, res) => res.json([]));
router.get("/validation", async (req, res) => res.json([]));
router.get("/errors", async (req, res) => res.json([]));
router.get("/sessions", async (req, res) => res.json([]));

export default router;
