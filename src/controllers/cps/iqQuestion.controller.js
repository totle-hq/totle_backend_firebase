// src/controllers/cps/iqQuestion.controller.js
// ----------------------------------------------------------------------------
// IQ Question CRUD (transactional) for cps.iq_questions → cps.iq_choices → cps.iq_rubrics
// ----------------------------------------------------------------------------

import { sequelize1 } from "../../config/sequelize.js";
import { IQQuestion } from "../../Models/CpsModels/IQQuestion.model.js";
import { IQChoice } from "../../Models/CpsModels/IQChoice.model.js";
import { IQRubric } from "../../Models/CpsModels/IQRubric.model.js";

// ---------- Helpers ----------
function ensureExactlyOneCorrect(choices = []) {
  const count = choices.filter((c) => !!c.isCorrect).length;
  if (count !== 1) throw new Error("Exactly one choice must be marked as correct.");
}

function validateRubrics(choices = []) {
  for (const c of choices) {
    if (!c.text || !c.text.trim()) throw new Error("Each choice must have non-empty text.");
    if (!Array.isArray(c.rubrics)) continue;
    for (const r of c.rubrics) {
      if (r.parameter === "" && Number(r.value) === 0) continue; // allowed as no-op
      if (!r.parameter || !r.parameter.trim()) throw new Error("Rubric parameter is required when value > 0.");
      const v = Number(r.value);
      if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error("Rubric value must be between 0 and 100.");
    }
  }
}

function toDTO(question, { includeChildren = true } = {}) {
  const base = {
    id: question.id,
    questionText: question.questionText,
    dimension: question.dimension,
    isActive: question.isActive,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
  if (!includeChildren) return base;

  const choices = (question.choices || []).map((ch) => ({
    id: ch.id,
    text: ch.text,
    isCorrect: ch.isCorrect,
    rubrics: (ch.rubrics || []).map((r) => ({
      id: r.id,
      parameter: r.parameter,
      value: r.value,
    })),
  }));

  return { ...base, choices };
}

// ---------- Controllers ----------

// POST /cps/iq-questions
export async function createIQQuestion(req, res) {
  const t = await sequelize1.transaction();
  try {
    const { questionText, dimension, isActive = true, choices = [] } = req.body;

    if (!questionText || questionText.trim().length < 10) {
      throw new Error("Question text must be at least 10 characters.");
    }
    if (!Array.isArray(choices) || choices.length !== 4) {
      throw new Error("Exactly four choices are required.");
    }

    ensureExactlyOneCorrect(choices);
    validateRubrics(choices);

    const question = await IQQuestion.create(
      { questionText, dimension: dimension || null, isActive },
      { transaction: t }
    );

    for (const c of choices) {
      const choice = await IQChoice.create(
        { questionId: question.id, text: c.text.trim(), isCorrect: !!c.isCorrect },
        { transaction: t }
      );
      if (Array.isArray(c.rubrics)) {
        const payload = c.rubrics
          .filter((r) => !(r.parameter === "" && Number(r.value) === 0))
          .map((r) => ({
            choiceId: choice.id,
            parameter: r.parameter.trim(),
            value: Number(r.value) || 0,
          }));
        if (payload.length) {
          await IQRubric.bulkCreate(payload, { transaction: t });
        }
      }
    }

    const created = await IQQuestion.scope(null).findByPk(question.id, {
      include: [{ model: IQChoice, as: "choices", include: [{ model: IQRubric, as: "rubrics" }] }],
      transaction: t,
    });

    await t.commit();
    return res.status(201).json({ ok: true, data: toDTO(created) });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ ok: false, error: err.message || "Failed to create question." });
  }
}

// GET /cps/iq-questions
export async function listIQQuestions(req, res) {
  try {
    const {
      dimension,                         // optional filter
      active,                            // "true" | "false"
      search,                            // substring in questionText
      page = 1,
      pageSize = 20,
      includeChildren = "true",
    } = req.query;

    const where = {};
    if (dimension) where.dimension = dimension;
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (search && search.trim()) {
      // Sequelize iLike only on Postgres
      where.questionText = { [sequelize1.Sequelize.Op.iLike]: `%${search.trim()}%` };
    }

    const limit = Math.min(Number(pageSize) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const include =
      includeChildren === "true"
        ? [{ model: IQChoice, as: "choices", include: [{ model: IQRubric, as: "rubrics" }] }]
        : [];

    const { rows, count } = await IQQuestion.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [
        ["createdAt", "DESC"],
        // ensure choice order stability when included
        [{ model: IQChoice, as: "choices" }, "createdAt", "ASC"],
      ],
    });

    return res.json({
      ok: true,
      meta: {
        page: Number(page) || 1,
        pageSize: limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
      data: rows.map((q) => toDTO(q, { includeChildren: includeChildren === "true" })),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || "Failed to list questions." });
  }
}

// GET /cps/iq-questions/:id
export async function getIQQuestion(req, res) {
  try {
    const { id } = req.params;
    const includeChildren = (req.query.includeChildren ?? "true") === "true";

    const question = await IQQuestion.findByPk(id, {
      include: includeChildren
        ? [{ model: IQChoice, as: "choices", include: [{ model: IQRubric, as: "rubrics" }] }]
        : [],
    });

    if (!question) return res.status(404).json({ ok: false, error: "Question not found." });
    return res.json({ ok: true, data: toDTO(question, { includeChildren }) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || "Failed to fetch question." });
  }
}

// PUT /cps/iq-questions/:id
export async function updateIQQuestion(req, res) {
  const t = await sequelize1.transaction();
  try {
    const { id } = req.params;
    const { questionText, dimension, isActive, choices } = req.body;

    const question = await IQQuestion.findByPk(id, {
      include: [{ model: IQChoice, as: "choices", include: [{ model: IQRubric, as: "rubrics" }] }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!question) throw new Error("Question not found.");

    if (typeof questionText === "string" && questionText.trim().length < 10) {
      throw new Error("Question text must be at least 10 characters.");
    }

    // Partial update of base fields
    if (typeof questionText === "string") question.questionText = questionText.trim();
    if (typeof dimension === "string") question.dimension = dimension || null;
    if (typeof isActive === "boolean") question.isActive = isActive;

    // If choices provided, full replace (simple + safe)
    if (Array.isArray(choices)) {
      if (choices.length !== 4) throw new Error("Exactly four choices are required.");
      ensureExactlyOneCorrect(choices);
      validateRubrics(choices);

      // delete existing children → recreate
      for (const ch of question.choices) {
        await IQRubric.destroy({ where: { choiceId: ch.id }, transaction: t });
      }
      await IQChoice.destroy({ where: { questionId: question.id }, transaction: t });

      for (const c of choices) {
        const choice = await IQChoice.create(
          { questionId: question.id, text: c.text.trim(), isCorrect: !!c.isCorrect },
          { transaction: t }
        );
        const payload = (c.rubrics || [])
          .filter((r) => !(r.parameter === "" && Number(r.value) === 0))
          .map((r) => ({
            choiceId: choice.id,
            parameter: r.parameter.trim(),
            value: Number(r.value) || 0,
          }));
        if (payload.length) await IQRubric.bulkCreate(payload, { transaction: t });
      }
    }

    await question.save({ transaction: t });

    const updated = await IQQuestion.findByPk(question.id, {
      include: [{ model: IQChoice, as: "choices", include: [{ model: IQRubric, as: "rubrics" }] }],
      transaction: t,
    });

    await t.commit();
    return res.json({ ok: true, data: toDTO(updated) });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ ok: false, error: err.message || "Failed to update question." });
  }
}

// DELETE /cps/iq-questions/:id
export async function deleteIQQuestion(req, res) {
  const t = await sequelize1.transaction();
  try {
    const { id } = req.params;
    const question = await IQQuestion.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!question) return res.status(404).json({ ok: false, error: "Question not found." });

    // CASCADE via associations
    await IQQuestion.destroy({ where: { id }, transaction: t });
    await t.commit();
    return res.json({ ok: true, message: "Question deleted." });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ ok: false, error: err.message || "Failed to delete question." });
  }
}
