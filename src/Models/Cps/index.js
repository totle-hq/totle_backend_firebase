// src/Models/Cps/index.js
import { sequelize1 } from "../../config/sequelize.js";

import { CpsQuestionBank } from "./CpsQuestionBank.model.js";
import { CpsRubricMapping } from "./CpsRubricMapping.model.js";
import { CpsPipelineRegistry } from "./CpsPipelineRegistry.model.js";
import { CpsGenerationLog } from "./CpsGenerationLog.model.js";
import { CpsValidationLog } from "./CpsValidationLog.model.js";
import { CpsErrorLog } from "./CpsErrorLog.model.js";
import { CpsUserQuestionLog } from "./CpsUserQuestionLog.model.js";
import { CpsTestSession } from "./CpsTestSession.model.js";
import { CpsTestResponse } from "./CpsTestResponse.model.js";

/**
 * 🧠 initCpsModels()
 * Establishes all internal CPS associations.
 * This function must be called once during system bootstrap,
 * right after sequelize1 is initialized but before DB sync.
 *
 * The CPS schema now covers:
 *   - Question ↔ RubricMapping (1:N)
 *   - Question ↔ TestResponse  (1:N)
 *   - TestSession ↔ TestResponse (1:N)
 *   - Registry + Logs remain standalone (loosely coupled)
 */
export function initCpsModels() {

      if (sequelize1.models.__CPS_INIT_DONE__) {
    console.log("⚠️ [CPS] Associations already initialized. Skipping re-init.");
    return;
  }
  sequelize1.models.__CPS_INIT_DONE__ = true;

  console.log("🔧 [CPS] Initializing model associations…");
  /* -----------------------------------------------------------
   * 1️⃣ Question → RubricMappings (1:N)
   * --------------------------------------------------------- */
  CpsQuestionBank.hasMany(CpsRubricMapping, {
    foreignKey: "question_id",
    sourceKey: "id",
    as: "rubrics",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CpsRubricMapping.belongsTo(CpsQuestionBank, {
    foreignKey: "question_id",
    targetKey: "id",
    as: "question",
  });

  /* -----------------------------------------------------------
   * 2️⃣ TestSession → TestResponses (1:N)
   * --------------------------------------------------------- */
  CpsTestSession.hasMany(CpsTestResponse, {
    foreignKey: "session_id",
    sourceKey: "id",
    as: "responses",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  CpsTestResponse.belongsTo(CpsTestSession, {
    foreignKey: "session_id",
    targetKey: "id",
    as: "session",
  });

  /* -----------------------------------------------------------
   * 3️⃣ Question → TestResponses (1:N)
   * --------------------------------------------------------- */
  CpsQuestionBank.hasMany(CpsTestResponse, {
    foreignKey: "question_id",
    sourceKey: "id",
    as: "answers",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });

  CpsTestResponse.belongsTo(CpsQuestionBank, {
    foreignKey: "question_id",
    targetKey: "id",
    as: "question",
  });

  /* -----------------------------------------------------------
   * ℹ️  Notes:
   * - Registry (CpsPipelineRegistry) & log tables (CpsGenerationLog,
   *   CpsValidationLog, CpsErrorLog, CpsUserQuestionLog) are intentionally
   *   kept decoupled for flexibility.
   * - Their relationships are traced via primitive keys like:
   *     batch_id, generation_batch_key, pipeline_name.
   * - This ensures fault isolation and resilience in CPS generation flow.
   * --------------------------------------------------------- */

  console.log("✅ [CPS] Model associations initialized successfully.");
}

/* -----------------------------------------------------------
 * Export all models for unified imports
 * --------------------------------------------------------- */
export {
  CpsQuestionBank,
  CpsRubricMapping,
  CpsPipelineRegistry,
  CpsGenerationLog,
  CpsValidationLog,
  CpsErrorLog,
  CpsUserQuestionLog,
  CpsTestSession,
  CpsTestResponse,
};
