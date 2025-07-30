

import { Op } from "sequelize";
import { FeedbackSummary } from "../Models/feedbacksummary.js";
import { findSubjectAndDomain } from "./getsubject.js";
/**
 * Calculates new averages and updates or creates a FeedbackSummary entry.
 *
 * @param {Object} params
 * @param {UUID} params.teacher_id
 * @param {UUID} params.node_id - ID of topic/subject/domain
 * @param {"topic" | "subject" | "domain"} params.node_type
 * @param {number} params.star_rating
 * @param {number} params.clarity_rating
 * @param {number} params.helpfulness_rating
 * @param {boolean} params.confidence_gain_yn
 * @param {boolean} params.engagement_yn
 * @param {"fast" | "normal" | "slow"} params.pace_feedback
 */




export const handleAllFeedbackSummaries = async ({
  teacher_id,
  topic_id,
  newFeedback,
}) => {
  try {
    
    const { domain, subject } = await findSubjectAndDomain(topic_id);
  

    const domain_id = domain.id;
    const subject_id = subject.id;

    const nodes = [
      { node_id: topic_id, node_type: "topic" },
      { node_id: domain_id, node_type: "domain" },
      { node_id: subject_id, node_type: "subject" },
    ];

    const normalizedPace = newFeedback.pace_feedback.toLowerCase();

    
    const existingSummaries = await FeedbackSummary.findAll({
      where: {
        teacher_id,
        [Op.or]: nodes.map(({ node_id, node_type }) => ({ node_id, node_type })),
      },
    });
  

    const summaryMap = new Map();
    for (const summary of existingSummaries) {
      summaryMap.set(`${summary.node_id}_${summary.node_type}`, summary);
    }

    for (const { node_id, node_type } of nodes) {
      const key = `${node_id}_${node_type}`;
      const existingSummary = summaryMap.get(key);

      if (existingSummary) {
        const newCount = existingSummary.feedback_count + 1;
        const updatedSummary = {
          avg_star_rating:
            (existingSummary.avg_star_rating * existingSummary.feedback_count +
              newFeedback.star_rating) /
            newCount,
          avg_clarity_rating:
            (existingSummary.avg_clarity_rating * existingSummary.feedback_count +
              newFeedback.clarity_rating) /
            newCount,
          avg_helpfulness_rating:
            (existingSummary.avg_helpfulness_rating * existingSummary.feedback_count +
              newFeedback.helpfulness_rating) /
            newCount,
          confidence_gain_percent: Math.round(
            (existingSummary.confidence_gain_percent * existingSummary.feedback_count +
              (newFeedback.confidence_gain_yn ? 100 : 0)) /
              newCount
          ),
          engagement_percent: Math.round(
            (existingSummary.engagement_percent * existingSummary.feedback_count +
              (newFeedback.engagement_yn ? 100 : 0)) /
              newCount
          ),
          pace_fast: existingSummary.pace_fast + (normalizedPace.includes("fast") ? 1 : 0),
          pace_normal: existingSummary.pace_normal + (normalizedPace.includes("normal") ? 1 : 0),
          pace_slow: existingSummary.pace_slow + (normalizedPace.includes("slow") ? 1 : 0),
          feedback_count: newCount,
        };

        
        await existingSummary.update(updatedSummary);
     } else {
        await FeedbackSummary.create({
          teacher_id,
          node_id,
          node_type,
          avg_star_rating: newFeedback.star_rating,
          avg_clarity_rating: newFeedback.clarity_rating,
          avg_helpfulness_rating: newFeedback.helpfulness_rating,
          confidence_gain_percent: newFeedback.confidence_gain_yn ? 100 : 0,
          engagement_percent: newFeedback.engagement_yn ? 100 : 0,
          pace_fast: normalizedPace.includes("fast") ? 1 : 0,
          pace_normal: normalizedPace.includes("normal") ? 1 : 0,
          pace_slow: normalizedPace.includes("slow") ? 1 : 0,
          feedback_count: 1,
        });
      }
    }

    return { success: true, message: "Feedback summary updated." };
  } catch (error) {
    console.error("Error updating feedback summaries:", error);
    return { success: false, message: "Internal error" };
  }
};



