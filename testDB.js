// import { catalogDb, userDb } from "./src/config/prismaClient.js";

// async function testDB() {
//   try {
//     // Check connection without fetching data
//     await userDb.$connect();
//     console.log("✅ Connected to User Database");

//     await catalogDb.$connect();
//     console.log("✅ Connected to Catalog Database");
//   } catch (error) {
//     console.error("❌ Database connection error:", error);
//   } finally {
//     // Close connections
//     await userDb.$disconnect();
//     await catalogDb.$disconnect();
//     console.log("✅ Prisma connections closed.");
//   }
// }

// Run the connection test
// testDB();
// const jwt = require('jsonwebtoken');
// import jwt from 'jsonwebtoken';

// const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4NWYwMzBjLWFhZTktNGU1Yy1iZmY3LTk1YmJiMjk2NmRmYSIsImVtYWlsIjoiMjQ5M3NhaWNoYXJhbkBnbWFpbC5jb20iLCJ1c2VyTmFtZSI6IlNhaSIsImlhdCI6MTc0MTAwMTkxNCwiZXhwIjoxNzQxNjA2NzE0fQ.Z9EN1S6GnFIMkHqOJ6UZFoCK4mp53UNt1PfrXzI1OOs";
// const secretKey = "sriragh-manohar-arif-vyshu-nikhila"; // Use the actual secret key

// try {
//     const decoded = jwt.verify(token, secretKey);
//     console.log(decoded); // Prints payload if the token is valid
// } catch (err) {
//     console.error("Invalid token:", err.message);
// }

// scripts/testQuestionGen.js

import dotenv from "dotenv";
import { generateQuestions } from "./src/services/questionGenerator.service.js";

dotenv.config();

// Mock learner profile: 33 user metrics
const learnerProfile = {
  concept_mastery: 80,
  accuracy: 75,
  skill_application: 60,
  creativity_expression: 65,
  application_of_knowledge: 70,
  speed: 45,
  problem_solving: 60,
  technical_mastery: 72,
  critical_thinking: 50,
  question_type_proficiency: 68,
  project_completion: 70,
  artistic_process: 55,
  retention: 40,
  exam_strategy: 60,
  adaptability: 70,
  performance_presentation: 64,
  written_verbal_expression: 68,
  syllabus_coverage: 78,
  creativity_innovation: 50,
  feedback_incorporation: 60,
  progress_in_curriculum: 75,
  mock_test_performance: 50,
  certification: 40,
  portfolio_development: 30,
  communication_skills: 55,
  stress_management: 25,
  practical_application: 30,
  growth_mindset: 80,
  collaboration: 60,
  innovation: 45,
  consistency: 70,
  self_reflection: 55,
  time_management: 40,
  resource_utilization: 60,
  resilience: 50,
};

// Mock topic parameters: 7 AI attributes
const topicParams = {
  complexity_level: "Advanced",             // Basic | Intermediate | Advanced | Expert
  engagement_factor: "High",               // Low | Medium | High
  retention_importance: "High",            // Low | Medium | High
  typical_learning_curve: "Hard",          // Easy | Medium | Hard
  depth_requirement: "Deep",               // Shallow | Moderate | Deep
  cross_domain_relevance: true,            // boolean
  application_type: "Practical",           // Theoretical | Practical
};

const topicName = "Integers";
const topicId = "92a1ae2f-6465-4003-ad15-dcf9c5e2be9e";
const userId = "6008cf05-f0b6-4dc2-9144-c2971e474b9e";

(async () => {
  try {
    const result = await generateQuestions({
      learnerProfile,
      topicParams,
      topicName,
      topicId,
      userId,
      count: 20,
    });

    console.log("\n✅ Questions Generated:");
    console.log(JSON.stringify(result.questions, null, 2));

    console.log("\n✅ Answers:");
    console.log(JSON.stringify(result.answers, null, 2));

    console.log("\n⏱️ Time Limit (Minutes):", result.time_limit_minutes);
  } catch (error) {
    console.error("❌ Error generating questions:", error.message);
  }
})();

