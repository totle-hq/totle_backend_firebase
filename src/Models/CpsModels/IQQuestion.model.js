// src/Models/CpsModels/IQQuestion.model.js
// ----------------------------------------------------------------------------
// IQQuestion (cps.iq_questions) — FULL MODEL (UI-upgraded, safe sync)
// - Includes all psychometric/admin fields used by the new frontend
// - Defensive beforeSync(): idempotently adds missing columns (incl. ENUM)
// - Keeps prior behavior (schema/table/timestamps/indexes/scopes)
// ----------------------------------------------------------------------------

import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const IQQuestion = sequelize1.define(
  "IQQuestion",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    // Core
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: { args: [10, 10000], msg: "Question text must be at least 10 characters." },
      },
    },
    dimension: {
      type: DataTypes.TEXT, // constrained by UI; flexible in DB
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true, // optional FK to user.User.id (not enforced here)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    // ------------------------------------------------------------------------
    // Psychometric & Admin fields (match UI)
    // ------------------------------------------------------------------------

    // Item-level indices (0..1, -1..1)
    difficultyIndex: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
      validate: {
        min: { args: [0], msg: "difficultyIndex must be >= 0.0" },
        max: { args: [1], msg: "difficultyIndex must be <= 1.0" },
        isFinite(v) { if (v != null && !Number.isFinite(v)) throw new Error("difficultyIndex must be finite"); },
      },
    },
    discriminationIndex: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
      validate: {
        min: { args: [-1], msg: "discriminationIndex must be >= -1.0" },
        max: { args: [1], msg: "discriminationIndex must be <= 1.0" },
        isFinite(v) { if (v != null && !Number.isFinite(v)) throw new Error("discriminationIndex must be finite"); },
      },
    },
    estimatedItemLoad: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
      validate: {
        min: { args: [0], msg: "estimatedItemLoad must be >= 0.0" },
        max: { args: [1], msg: "estimatedItemLoad must be <= 1.0" },
        isFinite(v) { if (v != null && !Number.isFinite(v)) throw new Error("estimatedItemLoad must be finite"); },
      },
    },

    // Timing & admin
    isTimed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    timeLimitSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: "timeLimitSeconds must be >= 0" } },
    },

    // Author difficulty label
    levelOfDifficulty: {
      type: DataTypes.ENUM("Easy", "Medium", "Hard", "Expert"),
      allowNull: true,
    },

    // Optional hint
    hintText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Cognitive tags
    cognitiveSkillTags: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    schema: "cps",
    tableName: "iq_questions",
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ["dimension"] },
      { fields: ["isActive", "createdAt"] },
      { name: "iq_questions_level_of_difficulty", fields: ["levelOfDifficulty"] },
      { name: "iq_questions_created_by", fields: ["createdBy"] },
    ],
    defaultScope: {
      where: {},
      order: [["createdAt", "DESC"]],
    },
    scopes: {
      active: { where: { isActive: true } },
      byDimension(dim) {
        return { where: { dimension: dim } };
      },
      withAll() {
        return {
          include: [
            {
              association: "choices",
              include: [{ association: "rubrics" }],
              order: [["createdAt", "ASC"]],
            },
          ],
        };
      },
    },

    // ---------------- Safe sync hook ----------------
    hooks: {
      /**
       * Ensure all new columns exist BEFORE Sequelize tries to build indexes.
       * Idempotent across environments (swallows “already exists” cases).
       */
      async beforeSync() {
        const qi = sequelize1.getQueryInterface();
        const tableName = "iq_questions";
        const schema = "cps";

        const describe = async () => {
          try {
            return await qi.describeTable(tableName, { schema });
          } catch {
            // Table may not exist yet on first-ever sync; return empty
            return {};
          }
        };

        const ensure = async (columnName, def) => {
          const desc = await describe();
          if (desc && desc[columnName]) return; // already there
          try {
            await qi.addColumn({ tableName, schema }, columnName, def);
          } catch {
            // swallow dup/exists errors to keep idempotent
          }
        };

        // ENUM-backed column — add first so index creation won't fail
        await ensure("levelOfDifficulty", { type: DataTypes.ENUM("Easy", "Medium", "Hard", "Expert"), allowNull: true });

        // All other UI-driven fields
        await ensure("difficultyIndex",     { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: 0.0 });
        await ensure("discriminationIndex", { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: 0.0 });
        await ensure("estimatedItemLoad",   { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: 0.0 });
        await ensure("isTimed",             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
        await ensure("timeLimitSeconds",    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
        await ensure("hintText",            { type: DataTypes.TEXT,    allowNull: true });
        await ensure("cognitiveSkillTags",  { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] });
      },
    },
  }
);
