import {
  CpsGenerationLog,
  CpsValidationLog,
  CpsErrorLog,
  CpsTestSession,
} from "../Models/Cps/index.js";
import { Op } from "sequelize";

export const getObservatoryLogs = async (req, res) => {
  try {
    const {
      limit = 50,
      testKind = "ALL",
      status,
      pipeline,
      q,
      from,
      to,
      cursor,
    } = req.query;

    const where = {};

    if (pipeline) where.pipeline_name = { [Op.iLike]: `%${pipeline}%` };
    if (status && status !== "ALL") where.status = status;
    if (q) {
      where[Op.or] = [
        { batch_id: { [Op.iLike]: `%${q}%` } },
        { user_id: { [Op.iLike]: `%${q}%` } },
        { session_id: { [Op.iLike]: `%${q}%` } },
        { generation_batch_key: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };

    const order = [["created_at", "DESC"]];

    const [gen, val, err, sess] = await Promise.all([
      CpsGenerationLog.findAll({ where, limit, order }),
      CpsValidationLog.findAll({ where, limit, order }),
      CpsErrorLog.findAll({ where, limit, order }),
      CpsTestSession.findAll({ where, limit, order }),
    ]);

    const normalize = (src, type) =>
      src.map((x) => ({
        id: x.id,
        created_at: x.created_at,
        type,
        test_kind: x.test_kind || "IQ",
        pipeline_name: x.pipeline_name || "default",
        batch_id: x.batch_id,
        generation_batch_key: x.generation_batch_key,
        status: x.status,
        message: x.message,
        user_id: x.user_id,
      }));

    const all = [
      ...normalize(gen, "GENERATION"),
      ...normalize(val, "VALIDATION"),
      ...normalize(err, "ERROR"),
      ...normalize(sess, "SESSION"),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    res.json({ items: all, nextCursor: null });
  } catch (err) {
    console.error("❌ [CPS LOGS] fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch logs", error: err.message });
  }
};
