// src/Models/CpsModels/IQChoice.model.js
// ----------------------------------------------------------------------------
// IQChoice (cps.iq_choices) — supports distractorEfficiency & data hygiene
// ----------------------------------------------------------------------------

import { DataTypes, Deferrable, Op } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

function clamp01(v) {
  if (v == null) return v;
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export const IQChoice = sequelize1.define(
  "IQChoice",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    // FK to cps.iq_questions.id (association is also set in Models/index.js)
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { tableName: "iq_questions", schema: "cps" },
        key: "id",
        deferrable: Deferrable.INITIALLY_IMMEDIATE,
      },
    },

    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Choice text cannot be empty." },
        len: { args: [1, 5000], msg: "Choice text is too long." },
      },
      set(val) {
        const v = val == null ? "" : String(val);
        this.setDataValue("text", v.trim());
      },
    },

    isCorrect: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // NEW: aligns with UI (0..1) for psychometric calibration
    distractorEfficiency: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
      validate: {
        isFinite(value) {
          if (value == null) return;
          if (!Number.isFinite(Number(value))) {
            throw new Error("distractorEfficiency must be a finite number.");
          }
        },
        inRange(value) {
          if (value == null) return;
          const n = Number(value);
          if (n < 0 || n > 1) {
            throw new Error("distractorEfficiency must be between 0.0 and 1.0.");
          }
        },
      },
      set(v) {
        this.setDataValue("distractorEfficiency", clamp01(v));
      },
    },
  },
  {
    schema: "cps",
    tableName: "iq_choices",
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ["questionId"] },
      { fields: ["isCorrect"] },
      { unique: true, fields: ["questionId", "text"] },
      { fields: ["questionId", "isCorrect"] },
      { name: "iq_choices_distractor_efficiency", fields: ["distractorEfficiency"] },
    ],
    defaultScope: {
      order: [["createdAt", "ASC"]],
    },
    hooks: {
      /**
       * Ensure the new column exists BEFORE Sequelize creates indexes.
       * Idempotent: swallows “already exists” errors across envs.
       */
      async beforeSync() {
        const qi = sequelize1.getQueryInterface();
        const schema = "cps";
        const tableName = "iq_choices";

        const describe = async () => {
          try {
            return await qi.describeTable(tableName, { schema });
          } catch {
            return {};
          }
        };

        const ensureColumn = async (columnName, def) => {
          const desc = await describe();
          if (desc && desc[columnName]) return;
          try {
            await qi.addColumn({ schema, tableName }, columnName, def);
          } catch {
            // ignore duplicate/exists errors
          }
        };

        await ensureColumn("distractorEfficiency", {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        });
      },

      // Optional guard: keep data tidy pre-validate
      beforeValidate(instance) {
        if (instance.text != null) {
          instance.text = String(instance.text).trim();
        }
        if (instance.distractorEfficiency != null) {
          instance.distractorEfficiency = clamp01(instance.distractorEfficiency);
        }
      },

      // Ensure only one correct choice per question.
      async afterSave(instance, options) {
        if (instance.isCorrect) {
          await IQChoice.update(
            { isCorrect: false },
            {
              where: {
                questionId: instance.questionId,
                id: { [Op.ne]: instance.id },
                isCorrect: true,
              },
              transaction: options?.transaction,
              individualHooks: false,
            }
          );
        }
      },
    },
  }
);

// (Optional) convenience DTO
IQChoice.prototype.toChoiceDTO = function () {
  return {
    id: this.id,
    questionId: this.questionId,
    text: this.text,
    isCorrect: !!this.isCorrect,
    distractorEfficiency:
      this.distractorEfficiency == null ? 0 : Number(this.distractorEfficiency),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};
