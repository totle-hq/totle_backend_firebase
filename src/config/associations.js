// config/associations.js
import { Admin } from "../Models/UserModels/AdminModel.js";
import { Blog } from "../Models/SurveyModels/BlogModel.js";
import { Language } from "../Models/LanguageModel.js";
import { Responses } from "../Models/SurveyModels/ResponsesModel.js";
import { Survey } from "../Models/SurveyModels/SurveyModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { UserMetrics } from "../Models/UserModels/UserMetricsModel.js";
import { Question } from "../Models/SurveyModels/QuestionModel.js";
import { OTP } from "../Models/UserModels/OtpModel.js";
import { MarketplaceSuggestion } from "../Models/SurveyModels/MarketplaceModel.js";
import { UserDepartment } from "../Models/UserModels/UserDepartment.js";
import { RoleAssignmentLog } from "../Models/UserModels/RoleAssignmentLog.js";
import { Department } from "../Models/UserModels/Department.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { TestFlag } from "../Models/TestflagModel.js";
import { Test } from "../Models/test.model.js";
import { SupportQueriesModel } from "../Models/SupportModels/SupportQueriesModel.js";
import { Session } from "../Models/SessionModel.js";
import { BookedSession } from "../Models/BookedSession.js";
import Feedback from "../Models/feedbackModels.js";
import { Role } from "../Models/UserModels/Roles.Model.js";
import { Payment } from "../Models/PaymentModels.js";
import { FeedbackSummary } from "../Models/feedbacksummary.js";

// ✅ NEW: CPS Profile model import
import { CpsProfile } from "../Models/CpsProfile.model.js";

const defineRelationships = () => {
  // User ↔ Responses
  User.hasMany(Responses, { foreignKey: "userId", onDelete: "CASCADE" });
  Responses.belongsTo(User, { foreignKey: "userId" });

  // User ↔ Preferred Language (guarded to avoid duplicate alias errors)
  if (!User.associations?.preferredLanguage) {
    User.belongsTo(Language, { foreignKey: "preferred_language_id", as: "preferredLanguage" });
  }
  if (!Language.associations?.users) {
    Language.hasMany(User, { foreignKey: "preferred_language_id", as: "users" });
  }

  // User ↔ UserMetrics
  User.hasOne(UserMetrics, { foreignKey: "userId", onDelete: "CASCADE" });
  UserMetrics.belongsTo(User, { foreignKey: "userId" });

  // ✅ NEW: User ↔ CPS Profile (one row per user)
  if (!User.associations?.cpsProfile) {
    User.hasOne(CpsProfile, {
      foreignKey: "user_id",
      as: "cpsProfile",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!CpsProfile.associations?.user) {
    CpsProfile.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  // Survey ↔ Questions
  Survey.hasMany(Question, { foreignKey: "surveyId", as: "questions" });
  Question.belongsTo(Survey, { foreignKey: "surveyId" });

  // Survey ↔ Responses
  Survey.hasMany(Responses, { foreignKey: "surveyId" });
  Responses.belongsTo(Survey, { foreignKey: "surveyId" });
  Responses.belongsTo(Question, { foreignKey: "questionId" });

  // Admin ↔ Blog
  Admin.hasMany(Blog, { foreignKey: "adminId" });
  Blog.belongsTo(Admin, { foreignKey: "adminId" });

  // Admin ↔ Survey
  Admin.hasMany(Survey, { foreignKey: "adminId" });
  Survey.belongsTo(Admin, { foreignKey: "adminId" });

  // User ↔ OTP
  User.hasMany(OTP, { foreignKey: "userId", onDelete: "CASCADE" });
  OTP.belongsTo(User, { foreignKey: "userId" });

  // User ↔ Marketplace Suggestions
  User.hasMany(MarketplaceSuggestion, { foreignKey: "userId", onDelete: "CASCADE" });
  MarketplaceSuggestion.belongsTo(User, { foreignKey: "userId" });

  // Admin ↔ Marketplace Suggestions
  Admin.hasMany(MarketplaceSuggestion, { foreignKey: "adminId", allowNull: true });

  // Admin ↔ Departments
  Admin.hasMany(UserDepartment, { foreignKey: "userId" });
  UserDepartment.belongsTo(Admin, { foreignKey: "userId" });

  // Admin ↔ RoleAssignmentLog
  Admin.hasMany(RoleAssignmentLog, { foreignKey: "userId" });
  RoleAssignmentLog.belongsTo(Admin, { foreignKey: "userId" });

  // Department ↔ UserDepartment
  Department.hasMany(UserDepartment, { foreignKey: "departmentId" });
  UserDepartment.belongsTo(Department, { foreignKey: "departmentId" });

  // Teacher ↔ Topic Stats
  Teachertopicstats.belongsTo(User, { foreignKey: "teacherId", as: "teacher", onDelete: "CASCADE" });
  User.hasMany(Teachertopicstats, { foreignKey: "teacherId", as: "topicStats", onDelete: "CASCADE" });

  // CatalogueNode ↔ TeacherTopicStats
  Teachertopicstats.belongsTo(CatalogueNode, { foreignKey: "node_id", onDelete: "CASCADE" });
  CatalogueNode.hasMany(Teachertopicstats, { foreignKey: "node_id", onDelete: "CASCADE" });

  // FeedbackSummary ↔ CatalogueNode
  FeedbackSummary.belongsTo(CatalogueNode, { foreignKey: "node_id", onDelete: "CASCADE" });
  CatalogueNode.hasMany(FeedbackSummary, { foreignKey: "node_id", onDelete: "CASCADE" });

  // User ↔ TestFlags
  TestFlag.belongsTo(User, { foreignKey: "user_id", as: "user" });
  User.hasMany(TestFlag, { foreignKey: "user_id", as: "testFlags" });

  // Test ↔ TestFlags
  TestFlag.belongsTo(Test, { foreignKey: "test_id", as: "test" });
  Test.hasMany(TestFlag, { foreignKey: "test_id", as: "flags" });

  // User ↔ Support Queries
  SupportQueriesModel.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });
  User.hasMany(SupportQueriesModel, { foreignKey: "user_id", onDelete: "CASCADE" });

  // Department ↔ SubDepartments
  Department.hasMany(Department, { foreignKey: "parentId", as: "subDepartments", onDelete: "CASCADE" });
  Department.belongsTo(Department, { foreignKey: "parentId", as: "parentDepartment" });

  // Department ↔ Roles
  Department.hasMany(Role, { foreignKey: "departmentId", onDelete: "CASCADE" });
  Role.belongsTo(Department, { foreignKey: "departmentId", onDelete: "CASCADE" });

  // Session ↔ User (Teacher)
  Session.belongsTo(User, { foreignKey: "teacher_id", as: "teacher" });
  User.hasMany(Session, { foreignKey: "teacher_id", as: "teachingSessions" });

  // Session ↔ CatalogueNode
  Session.belongsTo(CatalogueNode, { foreignKey: "topic_id", onDelete: "CASCADE" });
  CatalogueNode.hasMany(Session, { foreignKey: "topic_id", onDelete: "CASCADE" });

  // BookedSession ↔ User (Learner)
  BookedSession.belongsTo(User, { foreignKey: "learner_id", as: "student", onDelete: "CASCADE" });

  // CatalogueNode ↔ Self
  CatalogueNode.belongsTo(CatalogueNode, { foreignKey: "parent_id", as: "parentNode", onDelete: "CASCADE" });
  CatalogueNode.belongsTo(CatalogueNode, { as: "subject", foreignKey: "parent_id", onDelete: "CASCADE" });

  // BookedSession ↔ User (Teacher)
  BookedSession.belongsTo(User, { as: "teacher", foreignKey: "teacher_id", onDelete: "CASCADE" });

  // BookedSession ↔ CatalogueNode
  BookedSession.belongsTo(CatalogueNode, { as: "bookedTopic", foreignKey: "topic_id", onDelete: "CASCADE" });
  CatalogueNode.hasMany(BookedSession, { foreignKey: "topic_id", onDelete: "CASCADE" });

  // User ↔ FeedbackSummary
  User.hasMany(FeedbackSummary, { foreignKey: "teacher_id", as: "feedbackSummaries" });
  FeedbackSummary.belongsTo(User, { foreignKey: "teacher_id", as: "teacher" });

  // Session ↔ Feedback
  Session.hasMany(Feedback, {
    foreignKey: "session_id",
    as: "feedbacks",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Feedback.belongsTo(Session, {
    foreignKey: "session_id",
    as: "feedbackSession",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  // Payments
  Payment.belongsTo(Session, {
    foreignKey: "session_id",
    as: "sessionPayment",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  Session.hasOne(Payment, {
    foreignKey: "session_id",
    as: "payment",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  User.hasMany(Payment, { foreignKey: "user_id" });
  Payment.belongsTo(User, { foreignKey: "user_id" });

  // Test ↔ Payment
  Test.belongsTo(Payment, {
    foreignKey: "payment_id",
    as: "payment",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  Payment.hasOne(Test, {
    foreignKey: "payment_id",
    as: "test",
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });
};

export default defineRelationships;
