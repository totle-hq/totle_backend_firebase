import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { User } from "./UserModel.js";

const UserMetrics = sequelize1.define(
  "UserMetrics",
  {
    userId: {
      type: DataTypes.UUID, // ✅ Change to UUID to match `User` model
      primaryKey: true,
      references: {
        model: { schema: "user", tableName: "users" }, // ✅ Corrected schema reference
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    concept_mastery: { type: DataTypes.INTEGER, defaultValue: 0 },
    accuracy: { type: DataTypes.INTEGER, defaultValue: 0 },
    skill_application: { type: DataTypes.INTEGER, defaultValue: 0 },
    creativity_expression: { type: DataTypes.INTEGER, defaultValue: 0 },
    application_of_knowledge: { type: DataTypes.INTEGER, defaultValue: 0 },
    speed: { type: DataTypes.INTEGER, defaultValue: 0 },
    problem_solving: { type: DataTypes.INTEGER, defaultValue: 0 },
    technical_mastery: { type: DataTypes.INTEGER, defaultValue: 0 },
    critical_thinking: { type: DataTypes.INTEGER, defaultValue: 0 },
    question_type_proficiency: { type: DataTypes.INTEGER, defaultValue: 0 },
    project_completion: { type: DataTypes.INTEGER, defaultValue: 0 },
    artistic_process: { type: DataTypes.INTEGER, defaultValue: 0 },
    retention: { type: DataTypes.INTEGER, defaultValue: 0 },
    exam_strategy: { type: DataTypes.INTEGER, defaultValue: 0 },
    adaptability: { type: DataTypes.INTEGER, defaultValue: 0 },
    performance_presentation: { type: DataTypes.INTEGER, defaultValue: 0 },
    written_verbal_expression: { type: DataTypes.INTEGER, defaultValue: 0 },
    syllabus_coverage: { type: DataTypes.INTEGER, defaultValue: 0 },
    creativity_innovation: { type: DataTypes.INTEGER, defaultValue: 0 },
    feedback_incorporation: { type: DataTypes.INTEGER, defaultValue: 0 },
    progress_in_curriculum: { type: DataTypes.INTEGER, defaultValue: 0 },
    mock_test_performance: { type: DataTypes.INTEGER, defaultValue: 0 },
    certification: { type: DataTypes.INTEGER, defaultValue: 0 },
    portfolio_development: { type: DataTypes.INTEGER, defaultValue: 0 },
    communication_skills: { type: DataTypes.INTEGER, defaultValue: 0 },
    stress_management: { type: DataTypes.INTEGER, defaultValue: 0 },
    practical_application: { type: DataTypes.INTEGER, defaultValue: 0 },
    growth_mindset: { type: DataTypes.INTEGER, defaultValue: 0 },
    collaboration: { type: DataTypes.INTEGER, defaultValue: 0 },
    innovation: { type: DataTypes.INTEGER, defaultValue: 0 },
    consistency: { type: DataTypes.INTEGER, defaultValue: 0 },
    self_reflection: { type: DataTypes.INTEGER, defaultValue: 0 },
    time_management: { type: DataTypes.INTEGER, defaultValue: 0 },
    resource_utilization: { type: DataTypes.INTEGER, defaultValue: 0 },
    resilience: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    schema: "user", // ✅ Use "user" schema instead of "private"
    tableName: "user_metrics", // ✅ Correct table name
    timestamps: false, // ✅ No timestamps needed
  }
);



export { UserMetrics };
