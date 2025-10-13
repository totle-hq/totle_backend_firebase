// src/services/cpsScoreAggregator.service.js
// ------------------------------------------------------------
// Purpose: Aggregate user IQ test responses and update CPS profile dynamically
// ------------------------------------------------------------
import { CpsRubricMapping, CpsUserQuestionLog } from "../Models/Cps/index.js";
import { sequelize1 } from "../config/sequelize.js";

export async function aggregateAndUpsertCpsProfile({
  userId,
  context_type = "IQ",
  context_ref_id = null,
}) {
  const trx = await sequelize1.transaction();
  try {
    // 1️⃣ Fetch all user responses
    const responses = await CpsUserQuestionLog.findAll({
      where: { user_id: userId },
      attributes: ["question_id", "is_correct", "confidence", "time_spent_ms"],
      raw: true,
    });

    if (!responses.length) {
      await trx.rollback();
      console.warn(`[CPS] No responses found for user ${userId}`);
      return false;
    }

    // 2️⃣ Get all rubrics linked to those questions
    const questionIds = responses.map((r) => r.question_id);
    const rubrics = await CpsRubricMapping.findAll({
      where: { question_id: questionIds },
      attributes: ["question_id", "parameter_name", "weight"],
      raw: true,
    });

    // 3️⃣ Aggregate weighted scores per parameter
    const totals = {};
    const weights = {};

    for (const r of responses) {
      const linkedRubrics = rubrics.filter((x) => x.question_id === r.question_id);
      for (const rr of linkedRubrics) {
        const param = rr.parameter_name.toLowerCase();
        const weight = Number(rr.weight) || 0;
        const score = r.is_correct ? 1 : 0;

        totals[param] = (totals[param] || 0) + score * weight;
        weights[param] = (weights[param] || 0) + weight;
      }
    }

    // 4️⃣ Compute normalized parameter scores
    const paramScores = {};
    for (const [param, total] of Object.entries(totals)) {
      paramScores[param] = Number((total / (weights[param] || 1)).toFixed(4));
    }

    // 5️⃣ Compute overall score (mean of all parameters)
    const scoreValues = Object.values(paramScores);
    const overall_score =
      scoreValues.length > 0
        ? Number(
            (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(4)
          )
        : 0;

    console.log("[CPS DEBUG] ParamScores:", paramScores);
    console.log("[CPS DEBUG] Totals:", totals);
    console.log("[CPS DEBUG] Weights:", weights);

    // 6️⃣ Normalize keys for DB column compatibility
    const normalizedPayload = {};
    for (const [key, val] of Object.entries(paramScores)) {
      const cleanKey = key
        .trim()
        .toLowerCase()
        .replace(/[\s&/\\-]+/g, "_");
      normalizedPayload[cleanKey] = val;
    }

    normalizedPayload.overall_score = overall_score;

    // 7️⃣ Ensure all required columns exist
    const [existingColsResult] = await sequelize1.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'cps' AND table_name = 'cps_profiles';
    `);
    const existingCols = existingColsResult.map((r) => r.column_name);

    for (const col of Object.keys(normalizedPayload)) {
      if (!existingCols.includes(col)) {
        console.log(`🧩 [CPS] Creating missing column: ${col}`);
        await sequelize1.query(
          `ALTER TABLE cps.cps_profiles ADD COLUMN IF NOT EXISTS "${col}" DOUBLE PRECISION DEFAULT 0;`,
          { transaction: trx }
        );
      }
    }

    // 8️⃣ Dynamic UPSERT (raw SQL) to persist all columns safely
    const cols = Object.keys(normalizedPayload);
    const bindValues = Object.values(normalizedPayload);
    const colNames = cols.map((c) => `"${c}"`).join(", ");
    const valPlaceholders = bindValues.map((_, i) => `$${i + 3}`).join(", ");
    const setClause = cols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");

    const sql = `
      INSERT INTO cps.cps_profiles (user_id, context_type, ${colNames})
      VALUES ($1, $2, ${valPlaceholders})
      ON CONFLICT (user_id, context_type)
      DO UPDATE SET ${setClause};
    `;

    await sequelize1.query(sql, {
      bind: [userId, context_type, ...bindValues],
      transaction: trx,
    });

    await trx.commit();
    console.log(`✅ CPS profile updated for user ${userId}`);
    return true;
  } catch (err) {
    await trx.rollback();
    console.error("❌ CPS aggregation failed:", err);
    return false;
  }
}
