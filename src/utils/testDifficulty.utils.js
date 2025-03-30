// File: src/utils/testDifficulty.utils.js

/**
 * Determines difficulty level (beginner | intermediate | advanced | expert)
 * based on topic parameters and learner metrics.
 * 
 * @param {object} topicParams - topic.topic_params
 * @param {object} learnerProfile - 33 user learning metrics (condensed here)
 * @returns {string} difficultyLevel
 */
export function evaluateDifficulty(topicParams, learnerProfile) {
    // Weights can be further fine-tuned by academic/AI experts
    let score = 0;
  
    // Topic Parameters
    const complexityWeight = {
      Basic: 1,
      Intermediate: 2,
      Advanced: 3,
      Expert: 4,
    };
  
    const engagementWeight = {
      Low: 1,
      Medium: 2,
      High: 3,
    };
  
    const retentionWeight = {
      Low: 1,
      Medium: 2,
      High: 3,
    };
  
    const learningCurveWeight = {
      Easy: 1,
      Medium: 2,
      Hard: 3,
    };
  
    const depthWeight = {
      Shallow: 1,
      Moderate: 2,
      Deep: 3,
    };
  
    score += complexityWeight[topicParams.complexity_level] || 1;
    score += engagementWeight[topicParams.engagement_factor] || 1;
    score += retentionWeight[topicParams.retention_importance] || 1;
    score += learningCurveWeight[topicParams.typical_learning_curve] || 1;
    score += depthWeight[topicParams.depth_requirement] || 1;
  
    if (topicParams.cross_domain_relevance) score += 1;
    if (topicParams.application_type === "Practical") score += 1;
  
    // Learner Adjustments
    if (learnerProfile.confidence === "low") score += 1;
    if (learnerProfile.recent_performance === "poor") score -= 1;
    if (learnerProfile.speed === "slow") score -= 1;
  
    // Normalize and map score to difficulty
    if (score <= 6) return "beginner";
    if (score <= 9) return "intermediate";
    if (score <= 12) return "advanced";
    return "expert";
  }
  