// services/questionMaintenance.service.js

import { Op } from "sequelize";
import cron from "node-cron";
import moment from "moment";

import { generateQuestionsForDimension } from "./questionGenerator.service.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { ApiUsage } from "../Models/ApiUsage.model.js";
import { QuestionPool } from "../Models/Fallback/QuestionsPool.js";

const MAX_USAGE = 3;
const BUFFER = 2;
const USAGE_EXPIRY_LIMIT = 5;
const MONTHLY_AI_LIMIT = 2000;
const EXPIRY_MONTHS = 6;

/**
 * Dynamically calculate threshold: required + buffer
 */
function getThresholdForDimension(mix, dimension) {
  const required = Number(mix?.[dimension]) || 4;
  return required + BUFFER;
}

/**
 * Check and refill all understocked topic-dimension pools
 */
export async function refillUnderstockedQuestions() {
  const topics = await CatalogueNode.findAll({
    where: { is_topic: true, status: "active" }
  });

  for (const topic of topics) {
    const topicId = topic.node_id;
    const topicName = topic.name || "Unnamed";
    const mix = topic.recommended_item_mix || {};

    for (const [dimension, requiredCount] of Object.entries(mix)) {
      const threshold = getThresholdForDimension(mix, dimension);

      const usableCount = await QuestionPool.count({
        where: {
          topic_uuid: topicId,
          dimension,
          usage_count: { [Op.lt]: MAX_USAGE },
          is_archived: false,
        }
      });

      if (usableCount < threshold) {
        const toGenerate = threshold - usableCount + BUFFER;

        console.log(`♻️ Refill: ${topicName} → ${dimension} | Needed: ${toGenerate}`);

        const newQuestions = await generateQuestionsForDimension({
          topicName,
          dimension,
          count: toGenerate,
        });

        for (let i = 0; i < newQuestions.length; i++) {
          const q = newQuestions[i];

          await QuestionPool.findOrCreate({
            where: {
              topic_uuid: topicId,
              dimension,
              "question.text": q.text,
            },
            defaults: {
              topic_uuid: topicId,
              dimension,
              question: { text: q.text, options: q.options },
              correct_answer: q.correct_answer,
              usage_count: 0,
              is_buffer: i >= requiredCount,
              is_archived: false,
            },
          });
        }
      }
    }
  }
}

/**
 * Archive overused or stale questions
 */
export async function archiveStaleQuestions() {
  const expiryDate = moment().subtract(EXPIRY_MONTHS, "months").toDate();

  const [updatedCount] = await QuestionPool.update(
    { is_archived: true },
    {
      where: {
        is_archived: false,
        [Op.or]: [
          { usage_count: { [Op.gte]: USAGE_EXPIRY_LIMIT } },
          { createdAt: { [Op.lt]: expiryDate } },
        ],
      },
    }
  );

  if (updatedCount > 0) {
    console.log(`🗃️ Archived ${updatedCount} stale questions`);
  }
}

/**
 * Track and restrict API usage
 */
export async function checkApiBudget() {
  const monthKey = moment().format("YYYY-MM");

  const [record, _created] = await ApiUsage.findOrCreate({
    where: { month: monthKey },
    defaults: { month: monthKey, monthly_count: 0 },
  });

  const currentCount = record.monthly_count;
  const overLimit = currentCount >= MONTHLY_AI_LIMIT;

  return {
    overLimit,
    remaining: Math.max(0, MONTHLY_AI_LIMIT - currentCount),
    current: currentCount,
    notice: overLimit ? "⚠️ AI usage limit hit. Expect fallback questions." : null,
  };
}

/**
 * Schedule maintenance job to run daily
 */
export function scheduleQuestionPoolMaintenance() {
  console.log("📅 Question Pool Maintenance Scheduled - 3:00 AM daily");

  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("🚀 Starting daily maintenance...");
      await archiveStaleQuestions();
      await refillUnderstockedQuestions();
      console.log("✅ Maintenance completed.");
    } catch (err) {
      console.error("❌ Maintenance failed:", err);
    }
  });
}
