// controllers/Objectives/keyresult.controller.js

import { KeyResult } from '../../Models/Objectives/keyresult.model.js';
import { Objective } from '../../Models/Objectives/objective.model.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import { sequelize1 } from '../../config/sequelize.js';
import { Op } from 'sequelize';

/**
 * Utilities
 */
const isUUID = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const uuidOrNull = (v) => (isUUID(v) ? v : null);

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const NUM = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const isNumber = (v) => typeof v === 'number' && !Number.isNaN(v);

const VALID_OPERATORS = new Set(['gte', 'lte', 'eq', 'gt', 'lt']);
const VALID_STATUS = new Set(['on_track', 'at_risk', 'off_track', 'paused', 'done']);

const cleanOperator = (op) => {
  if (op == null) return null;
  const x = String(op).trim();
  return VALID_OPERATORS.has(x) ? x : null;
};

const cleanStatus = (s) => {
  if (s == null) return 'on_track';
  const x = String(s).trim();
  return VALID_STATUS.has(x) ? x : 'on_track';
};

// Accept only YYYY-MM-DD (DATEONLY); otherwise null
const dateOrNull = (v) => {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : v;
};

/**
 * Compute progress% when target/current/operator are present and progress not explicitly provided.
 */
function deriveProgress({ targetOperator, targetValue, currentValue }) {
  if (!VALID_OPERATORS.has(targetOperator)) return null;
  if (!isNumber(targetValue) || !isNumber(currentValue)) return null;

  const eps = 1e-6;
  let pct = null;

  switch (targetOperator) {
    case 'gte':
    case 'gt':
      if (targetValue <= 0) return null;
      pct = (currentValue / targetValue) * 100;
      break;
    case 'lte':
    case 'lt':
      pct = (targetValue / Math.max(currentValue, eps)) * 100;
      break;
    case 'eq':
      if (targetValue === 0) return currentValue === 0 ? 100 : 0;
      pct = (currentValue / targetValue) * 100;
      break;
    default:
      return null;
  }
  return clamp(Math.round(pct), 0, 100);
}

/**
 * Whitelist & normalize incoming KR payload fields
 */
function parseKeyResultBody(raw = {}, { allowPartial = false } = {}) {
  const {
    description,
    progress,

    targetMetric,
    targetOperator,
    targetValue,
    unit,
    currentValue,
    measureSource,

    status,
    ownerDepartmentId,
    ownerUserId,

    startDate,
    dueDate,

    // optional ordering
    priority,
    order,
  } = raw;

  const out = {};

  // Description
  if (description !== undefined) {
    const desc = String(description ?? '').trim();
    if (!allowPartial && desc.length === 0) {
      throw new Error('Description is required');
    }
    if (description !== undefined) out.description = desc;
  }

  // Progress (0..100)
  if (progress !== undefined) {
    const p = NUM(progress);
    if (p === null || Number.isNaN(p)) throw new Error('Progress must be a number');
    out.progress = clamp(Math.round(p), 0, 100);
  }

  // Targeting + measurement
  if (targetMetric !== undefined) out.targetMetric = targetMetric ? String(targetMetric).trim() : null;

  if (targetOperator !== undefined) {
    out.targetOperator = cleanOperator(targetOperator);
  }

  if (targetValue !== undefined) {
    const tv = NUM(targetValue);
    if (targetValue !== null && (tv === null || Number.isNaN(tv))) {
      throw new Error('targetValue must be numeric or null');
    }
    out.targetValue = tv;
  }

  if (unit !== undefined) out.unit = unit ? String(unit).trim() : null;

  if (currentValue !== undefined) {
    const cv = NUM(currentValue);
    if (currentValue !== null && (cv === null || Number.isNaN(cv))) {
      throw new Error('currentValue must be numeric or null');
    }
    out.currentValue = cv;
  }

  if (measureSource !== undefined) {
    out.measureSource = measureSource ? String(measureSource).trim() : null;
  }

  // Status
  if (status !== undefined) {
    out.status = cleanStatus(status);
  }

  // Ownership — **coerce to null if not valid UUID** (prevents 22P02)
  if (ownerDepartmentId !== undefined) {
    out.ownerDepartmentId = uuidOrNull(ownerDepartmentId);
  }
  if (ownerUserId !== undefined) {
    out.ownerUserId = uuidOrNull(ownerUserId);
  }

  // Dates — **only YYYY-MM-DD accepted**
  if (startDate !== undefined) out.startDate = dateOrNull(startDate);
  if (dueDate !== undefined) out.dueDate = dateOrNull(dueDate);

  // Optional ordering knobs
  if (priority !== undefined) {
    const pr = NUM(priority);
    if (pr === null || Number.isNaN(pr)) throw new Error('priority must be numeric');
    out.priority = Math.max(1, Math.floor(pr));
  }
  if (order !== undefined) {
    const or = NUM(order);
    if (or === null || Number.isNaN(or)) throw new Error('order must be numeric');
    out.order = Math.max(0, Math.floor(or));
  }

  return out;
}

/**
 * @route POST /api/objectives/:objectiveId/key-results
 * @desc Create a new Key Result (supports extended fields)
 */
export const createKeyResult = async (req, res) => {
  try {
    const { objectiveId } = req.params;

    // 1) Validate objective
    const objective = await Objective.findByPk(objectiveId);
    if (!objective) {
      return res.status(404).json({ success: false, message: 'Objective not found' });
    }

    // 2) Determine priority & order within the objective
    const highestPriority = await KeyResult.findOne({
      where: { objectiveId },
      order: [['priority', 'DESC']],
    });
    const newPriority = highestPriority ? highestPriority.priority + 1 : 1;

    const latestOrder = (await KeyResult.max('order', { where: { objectiveId } })) || 0;

    // 3) Generate KR code (kept logic)
    const count = await KeyResult.count({ where: { objectiveId } });
    const next = String(count + 1).padStart(2, '0');
    const keyResultCode = `${objective.objectiveCode.replace('-', '')}-KR${next}`;

    // 4) Parse + validate body (strict)
    const body = parseKeyResultBody(req.body, { allowPartial: false });

    // 5) Auto-derive progress if not provided
    if (body.progress === undefined) {
      const auto = deriveProgress({
        targetOperator: body.targetOperator,
        targetValue: body.targetValue,
        currentValue: body.currentValue,
      });
      if (auto !== null) body.progress = auto;
    }

    // 6) Create KR
    const keyResult = await KeyResult.create({
      keyResultId: uuidv4(),
      objectiveId,
      keyResultCode,

      description: body.description,
      progress: body.progress ?? 0,

      targetMetric: body.targetMetric ?? null,
      targetOperator: body.targetOperator ?? null,
      targetValue: body.targetValue ?? null,
      unit: body.unit ?? null,
      currentValue: body.currentValue ?? null,
      measureSource: body.measureSource ?? null,
      status: body.status ?? undefined, // let model default if undefined

      ownerDepartmentId: body.ownerDepartmentId ?? null,
      ownerUserId: body.ownerUserId ?? null,

      startDate: body.startDate ?? null,
      dueDate: body.dueDate ?? null,

      priority: body.priority ?? newPriority,
      order: body.order ?? latestOrder,
    });

    return res.status(201).json({ success: true, data: keyResult });
  } catch (error) {
    logger.error('Failed to create key result:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Invalid request' });
  }
};

/**
 * @route GET /api/objectives/:objectiveId/key-results
 * @desc Get all Key Results for a specific Objective
 */
export const getKeyResultsByObjective = async (req, res) => {
  try {
    const { objectiveId } = req.params;
    const results = await KeyResult.findAll({
      where: { objectiveId },
      order: [['priority', 'ASC']],
    });
    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to fetch key results:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * @route GET /api/objectives/key-results/:id/detail
 * @desc Get a Key Result by UUID or Code
 */
export const getKeyResultById = async (req, res) => {
  try {
    const { id } = req.params;

    const whereClause = isUUID(id) ? { keyResultId: id } : { keyResultCode: id };

    const keyResult = await KeyResult.findOne({ where: whereClause });

    if (!keyResult) {
      return res.status(404).json({ message: 'KeyResult not found' });
    }

    res.status(200).json({ data: keyResult });
  } catch (error) {
    logger.error('❌ Error fetching key result:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

/**
 * @route DELETE /api/objectives/:objectiveId/key-results/:keyResultId
 * @desc Hard delete a Key Result
 */
export const deleteKeyResult = async (req, res) => {
  try {
    const { objectiveId, keyResultId } = req.params;

    const keyResult = await KeyResult.findOne({ where: { keyResultId, objectiveId } });
    if (!keyResult) {
      return res.status(404).json({ success: false, message: 'Key Result not found' });
    }

    await KeyResult.destroy({ where: { keyResultId, objectiveId }, force: true });

    return res.status(200).json({ success: true, message: 'Key Result deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete key result:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * @route PUT /api/objectives/:objectiveId/key-results/:keyResultId
 * @desc Update a Key Result (partial updates allowed)
 */
export const updateKeyResult = async (req, res) => {
  try {
    const { objectiveId, keyResultId } = req.params;

    const keyResult = await KeyResult.findOne({ where: { keyResultId, objectiveId } });
    if (!keyResult) {
      return res.status(404).json({ success: false, message: 'Key Result not found' });
    }

    // Parse with partial allow + strict coercions
    const patch = parseKeyResultBody(req.body, { allowPartial: true });

    // If progress not provided but target/current/operator changed or present, try to derive
    const canDerive =
      patch.progress === undefined &&
      (patch.targetOperator !== undefined ||
        patch.targetValue !== undefined ||
        patch.currentValue !== undefined);

    if (canDerive) {
      const operator = patch.targetOperator ?? keyResult.targetOperator;
      const targetVal = patch.targetValue ?? keyResult.targetValue;
      const currentVal = patch.currentValue ?? keyResult.currentValue;

      const auto = deriveProgress({
        targetOperator: operator,
        targetValue: targetVal,
        currentValue: currentVal,
      });
      if (auto !== null) patch.progress = auto;
    }

    Object.assign(keyResult, patch);

    await keyResult.save();

    return res
      .status(200)
      .json({ success: true, data: keyResult, message: 'Key Result updated successfully' });
  } catch (error) {
    logger.error('Failed to update key result:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Invalid request' });
  }
};

/**
 * @route PUT /api/objectives/keyresult/priority/:keyresultId
 * @desc Re-order priority within an objective (stable)
 */
export const updatekeyresultPriority = async (req, res) => {
  try {
    const { keyresultId } = req.params;
    const { newPriority } = req.body;

    const keyResult = await KeyResult.findByPk(keyresultId);
    if (!keyResult) {
      return res.status(404).json({ message: 'Key result not found' });
    }

    const oldPriority = keyResult.priority;
    const nextPriority = parseInt(newPriority, 10);
    if (!Number.isFinite(nextPriority) || nextPriority < 1) {
      return res.status(400).json({ message: 'Invalid newPriority' });
    }

    if (nextPriority === oldPriority) {
      return res.status(200).json({ message: 'Priority unchanged', data: keyResult });
    }

    const t = await sequelize1.transaction();

    try {
      if (nextPriority < oldPriority) {
        await KeyResult.update(
          { priority: sequelize1.literal('priority + 1') },
          {
            where: {
              objectiveId: keyResult.objectiveId,
              priority: { [Op.gte]: nextPriority, [Op.lt]: oldPriority },
            },
            transaction: t,
          }
        );
      } else {
        await KeyResult.update(
          { priority: sequelize1.literal('priority - 1') },
          {
            where: {
              objectiveId: keyResult.objectiveId,
              priority: { [Op.lte]: nextPriority, [Op.gt]: oldPriority },
            },
            transaction: t,
          }
        );
      }

      keyResult.priority = nextPriority;
      await keyResult.save({ transaction: t });

      await t.commit();

      return res.status(200).json({ message: 'Priority updated successfully', data: keyResult });
    } catch (err) {
      await t.rollback();
      logger.error('Transaction failed (priority):', err);
      return res.status(500).json({ message: 'Failed to update priority' });
    }
  } catch (error) {
    logger.error('❌ Error updating key result priority:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};
