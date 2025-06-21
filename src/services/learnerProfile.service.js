// File: src/services/learnerProfile.service.js

import { UserMetrics } from "../Models/UserModels/UserMetricsModel.js";
// import { UserProfile } from "../Models/UserModels/userProfile.model.js";

/**
 * Retrieves the 33 learning metrics for a specific user.
 * @param {string} userId - UUID of the user.
 * @returns {Promise<object>} - Learning metrics JSON.
 */
export async function getUserLearningMetrics(userId) {
  try {
    const profile = await UserMetrics.findOne({ where: { userId: userId } });

    if (!profile) {
      throw new Error(`No user profile found for user_id: ${userId}`);
    }

    return {
      concept_mastery: profile.concept_mastery,
      accuracy: profile.accuracy,
      skill_application: profile.skill_application,
      creativity_expression: profile.creativity_expression,
      application_of_knowledge: profile.application_of_knowledge,
      speed: profile.speed,
      problem_solving: profile.problem_solving,
      technical_mastery: profile.technical_mastery,
      critical_thinking: profile.critical_thinking,
      question_type_proficiency: profile.question_type_proficiency,
      project_completion: profile.project_completion,
      artistic_process: profile.artistic_process,
      retention: profile.retention,
      exam_strategy: profile.exam_strategy,
      adaptability: profile.adaptability,
      performance_presentation: profile.performance_presentation,
      written_verbal_expression: profile.written_verbal_expression,
      syllabus_coverage: profile.syllabus_coverage,
      creativity_innovation: profile.creativity_innovation,
      feedback_incorporation: profile.feedback_incorporation,
      progress_in_curriculum: profile.progress_in_curriculum,
      mock_test_performance: profile.mock_test_performance,
      certification: profile.certification,
      portfolio_development: profile.portfolio_development,
      communication_skills: profile.communication_skills,
      stress_management: profile.stress_management,
      practical_application: profile.practical_application,
      growth_mindset: profile.growth_mindset,
      collaboration: profile.collaboration,
      innovation: profile.innovation,
      consistency: profile.consistency,
      self_reflection: profile.self_reflection,
      time_management: profile.time_management,
      resource_utilization: profile.resource_utilization,
      resilience: profile.resilience,
    };
  } catch (error) {
    console.error("❌ Error in getUserLearningMetrics:", error);
    throw error;
  }
}
