// src/config/associations.js
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
// import { BookedSession } from "../Models/BookedSession.js";
import Feedback from "../Models/feedbackModels.js";
import { Role } from "../Models/UserModels/Roles.Model.js";
import { Payment } from "../Models/PaymentModels.js";
import { FeedbackSummary } from "../Models/feedbacksummary.js";

// CPS / Rubrics
import { CpsProfile } from "../Models/CpsProfile.model.js";
import { TestItemRubric } from "../Models/TestItemRubric.model.js";
import  TeacherAvailability  from "../Models/TeacherAvailability.js";

const defineRelationships = () => {
  /* =========================
   * User core relationships
   * ========================= */
  if (!User.associations?.preferredLanguage) {
    User.belongsTo(Language, { foreignKey: "preferred_language_id", as: "preferredLanguage" });
  }
  if (!Language.associations?.users) {
    Language.hasMany(User, { foreignKey: "preferred_language_id", as: "users" });
  }

  if (!User.associations?.metrics) {
    User.hasOne(UserMetrics, { foreignKey: "userId", as: "metrics", onDelete: "CASCADE" });
  }
  if (!UserMetrics.associations?.user) {
    UserMetrics.belongsTo(User, { foreignKey: "userId", as: "user" });
  }

  if (!User.associations?.otps) {
    User.hasMany(OTP, { foreignKey: "userId", as: "otps", onDelete: "CASCADE" });
  }
  if (!OTP.associations?.user) {
    OTP.belongsTo(User, { foreignKey: "userId", as: "user" });
  }

  if (!User.associations?.marketplaceSuggestions) {
    User.hasMany(MarketplaceSuggestion, { foreignKey: "userId", as: "marketplaceSuggestions", onDelete: "CASCADE" });
  }
  if (!MarketplaceSuggestion.associations?.user) {
    MarketplaceSuggestion.belongsTo(User, { foreignKey: "userId", as: "user" });
  }

  if (!Admin.associations?.marketplaceSuggestions) {
    Admin.hasMany(MarketplaceSuggestion, { foreignKey: "adminId", as: "marketplaceSuggestions", allowNull: true });
  }

  if (!Admin.associations?.departments) {
    Admin.hasMany(UserDepartment, { foreignKey: "userId", as: "departments" });
  }
  if (!UserDepartment.associations?.admin) {
    UserDepartment.belongsTo(Admin, { foreignKey: "userId", as: "admin" });
  }

  if (!Admin.associations?.roleAssignmentLogs) {
    Admin.hasMany(RoleAssignmentLog, { foreignKey: "userId", as: "roleAssignmentLogs" });
  }
  if (!RoleAssignmentLog.associations?.admin) {
    RoleAssignmentLog.belongsTo(Admin, { foreignKey: "userId", as: "admin" });
  }

  /* =========================
   * CPS Profile (1:N)
   * ========================= */
  // Each user can have multiple CPS profiles (IQ + per Domain)
  if (!User.associations?.cpsProfiles) {
    User.hasMany(CpsProfile, {
      foreignKey: "user_id",
      as: "cpsProfiles",
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

  // Optional domain linkage (for context_ref_id)
  if (!CpsProfile.associations?.domain) {
    CpsProfile.belongsTo(CatalogueNode, {
      foreignKey: "context_ref_id",
      as: "domain",
      constraints: false,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }

  if (!CatalogueNode.associations?.cpsProfiles) {
    CatalogueNode.hasMany(CpsProfile, {
      foreignKey: "context_ref_id",
      as: "cpsProfiles",
      constraints: false,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }

  /* =========================
   * Survey / Questions / Responses
   * ========================= */
  if (!Survey.associations?.questions) {
    Survey.hasMany(Question, { foreignKey: "surveyId", as: "questions" });
  }
  if (!Question.associations?.survey) {
    Question.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });
  }

  if (!Survey.associations?.responses) {
    Survey.hasMany(Responses, { foreignKey: "surveyId", as: "responses" });
  }
  if (!Responses.associations?.survey) {
    Responses.belongsTo(Survey, { foreignKey: "surveyId", as: "survey" });
  }

  if (!Question.associations?.responses) {
    Question.hasMany(Responses, { foreignKey: "questionId", as: "responses" });
  }
  if (!Responses.associations?.question) {
    Responses.belongsTo(Question, { foreignKey: "questionId", as: "question" });
  }

  if (!User.associations?.responses) {
    User.hasMany(Responses, { foreignKey: "userId", as: "responses", onDelete: "CASCADE" });
  }
  if (!Responses.associations?.user) {
    Responses.belongsTo(User, { foreignKey: "userId", as: "user" });
  }

  if (!Admin.associations?.blogs) {
    Admin.hasMany(Blog, { foreignKey: "adminId", as: "blogs" });
  }
  if (!Blog.associations?.admin) {
    Blog.belongsTo(Admin, { foreignKey: "adminId", as: "admin" });
  }

  if (!Admin.associations?.surveys) {
    Admin.hasMany(Survey, { foreignKey: "adminId", as: "surveys" });
  }
  if (!Survey.associations?.admin) {
    Survey.belongsTo(Admin, { foreignKey: "adminId", as: "admin" });
  }

    // User ↔ TeacherAvailability
  if (!User.associations?.availabilities) {
    User.hasMany(TeacherAvailability, {
      foreignKey: "teacher_id",
      as: "availabilities",
      allowNull: true,
    });
  }

  if (!TeacherAvailability.associations?.teacher) {
    TeacherAvailability.belongsTo(User, {
      foreignKey: "teacher_id",
      as: "teacher",
    });
  }

  /* =========================
   * Departments / Roles
   * ========================= */
  if (!Department.associations?.subDepartments) {
    Department.hasMany(Department, { foreignKey: "parentId", as: "subDepartments", onDelete: "CASCADE" });
  }
  if (!Department.associations?.parentDepartment) {
    Department.belongsTo(Department, { foreignKey: "parentId", as: "parentDepartment" });
  }

  if (!Department.associations?.roles) {
    Department.hasMany(Role, { foreignKey: "departmentId", as: "roles", onDelete: "CASCADE" });
  }
  if (!Role.associations?.department) {
    Role.belongsTo(Department, { foreignKey: "departmentId", as: "department", onDelete: "CASCADE" });
  }

  /* =========================
   * Teaching stats ↔ Catalogue
   * ========================= */
  if (!Teachertopicstats.associations?.teacher) {
    Teachertopicstats.belongsTo(User, { foreignKey: "teacherId", as: "teacher", onDelete: "CASCADE" });
  }
  if (!User.associations?.topicStats) {
    User.hasMany(Teachertopicstats, { foreignKey: "teacherId", as: "topicStats", onDelete: "CASCADE" });
  }

  if (!Teachertopicstats.associations?.catalogueNode) {
    Teachertopicstats.belongsTo(CatalogueNode, { foreignKey: "node_id", as: "catalogueNode", onDelete: "CASCADE" });
  }
  if (!CatalogueNode.associations?.teacherStats) {
    CatalogueNode.hasMany(Teachertopicstats, { foreignKey: "node_id", as: "teacherStats", onDelete: "CASCADE" });
  }

  /* =========================
   * CatalogueNode self refs
   * ========================= */
  if (!CatalogueNode.associations?.parentNode) {
    CatalogueNode.belongsTo(CatalogueNode, { foreignKey: "parent_id", as: "parentNode", onDelete: "CASCADE" });
  }
  if (!CatalogueNode.associations?.subject) {
    CatalogueNode.belongsTo(CatalogueNode, { foreignKey: "parent_id", as: "subject", onDelete: "CASCADE" });
  }

  /* =========================
   * Support / FeedbackSummary
   * ========================= */
  if (!SupportQueriesModel.associations?.user) {
    SupportQueriesModel.belongsTo(User, { foreignKey: "user_id", as: "user", onDelete: "CASCADE" });
  }
  if (!User.associations?.supportQueries) {
    User.hasMany(SupportQueriesModel, { foreignKey: "user_id", as: "supportQueries", onDelete: "CASCADE" });
  }

  if (!FeedbackSummary.associations?.catalogueNode) {
    FeedbackSummary.belongsTo(CatalogueNode, { foreignKey: "node_id", as: "catalogueNode", onDelete: "CASCADE" });
  }
  if (!CatalogueNode.associations?.feedbackSummaries) {
    CatalogueNode.hasMany(FeedbackSummary, { foreignKey: "node_id", as: "feedbackSummaries", onDelete: "CASCADE" });
  }

  if (!User.associations?.feedbackSummaries) {
    User.hasMany(FeedbackSummary, { foreignKey: "teacher_id", as: "feedbackSummaries" });
  }
  if (!FeedbackSummary.associations?.teacher) {
    FeedbackSummary.belongsTo(User, { foreignKey: "teacher_id", as: "teacher" });
  }

  /* =========================
   * Sessions / Bookings / Feedback
   * ========================= */
  if (!Session.associations?.teacher) {
    Session.belongsTo(User, { foreignKey: "teacher_id", as: "teacher" });
  }
  if (!Session.associations?.student) {
    Session.belongsTo(User, {
      foreignKey: "student_id",
      as: "student",
      onDelete: "SET NULL",
    });
  }
  if (!User.associations?.learningSessions) {
    User.hasMany(Session, {
      foreignKey: "student_id",
      as: "learningSessions",
      onDelete: "SET NULL",
    });
  }

  if (!User.associations?.teachingSessions) {
    User.hasMany(Session, { foreignKey: "teacher_id", as: "teachingSessions" });
  }

  if (!Session.associations?.catalogueNode) {
    Session.belongsTo(CatalogueNode, { foreignKey: "topic_id", as: "catalogueNode", onDelete: "CASCADE" });
  }
  if (!CatalogueNode.associations?.sessions) {
    CatalogueNode.hasMany(Session, { foreignKey: "topic_id", as: "sessions", onDelete: "CASCADE" });
  }

  // if (!BookedSession.associations?.student) {
  //   BookedSession.belongsTo(User, { foreignKey: "learner_id", as: "student", onDelete: "CASCADE" });
  // }
  // if (!BookedSession.associations?.teacher) {
  //   BookedSession.belongsTo(User, { foreignKey: "teacher_id", as: "teacher", onDelete: "CASCADE" });
  // }
  // if (!BookedSession.associations?.bookedTopic) {
  //   BookedSession.belongsTo(CatalogueNode, { foreignKey: "topic_id", as: "bookedTopic", onDelete: "CASCADE" });
  // }
  // if (!CatalogueNode.associations?.bookedSessions) {
  //   CatalogueNode.hasMany(BookedSession, { foreignKey: "topic_id", as: "bookedSessions", onDelete: "CASCADE" });
  // }

  if (!Session.associations?.feedbacks) {
    Session.hasMany(Feedback, { foreignKey: "session_id", as: "feedbacks", onDelete: "CASCADE", onUpdate: "CASCADE" });
  }
  if (!Feedback.associations?.feedbackSession) {
    Feedback.belongsTo(Session, { foreignKey: "session_id", as: "feedbackSession", onDelete: "CASCADE", onUpdate: "CASCADE" });
  }

  /* =========================
   * Payments (NO session_id)
   * ========================= */
  if (!User.associations?.payments) {
    User.hasMany(Payment, { foreignKey: "user_id", as: "payments" });
  }
  if (!Payment.associations?.user) {
    Payment.belongsTo(User, { foreignKey: "user_id", as: "user" });
  }

  if (!Test.associations?.payment) {
    Test.belongsTo(Payment, { foreignKey: "payment_id", as: "payment", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  }
  if (!Payment.associations?.test) {
    Payment.hasOne(Test, { foreignKey: "payment_id", as: "test", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  }

  /* =========================
   * Test flags / rubrics
   * ========================= */
  if (!TestFlag.associations?.user) {
    TestFlag.belongsTo(User, { foreignKey: "user_id", as: "user" });
  }
  if (!User.associations?.testFlags) {
    User.hasMany(TestFlag, { foreignKey: "user_id", as: "testFlags" });
  }

  if (!TestFlag.associations?.test) {
    TestFlag.belongsTo(Test, { foreignKey: "test_id", as: "test" });
  }
  if (!Test.associations?.flags) {
    Test.hasMany(TestFlag, { foreignKey: "test_id", as: "flags" });
  }

  if (!Test.associations?.itemRubrics) {
    Test.hasMany(TestItemRubric, { foreignKey: "test_id", as: "itemRubrics", onDelete: "CASCADE", onUpdate: "CASCADE" });
  }
  if (!TestItemRubric.associations?.test) {
    TestItemRubric.belongsTo(Test, { foreignKey: "test_id", as: "test", onDelete: "CASCADE", onUpdate: "CASCADE" });
  }
  

  if (!TeacherAvailability.associations?.catalogueNode) {
    TeacherAvailability.belongsToMany(CatalogueNode, {
      through: "user.teacher_availability_topics", // or your defined join model
      foreignKey: "availability_id",
      otherKey: "topic_id",
      as: "catalogueNode",
    });
  }

  if (!CatalogueNode.associations?.teacherAvailability) {
    CatalogueNode.belongsToMany(TeacherAvailability, {
      through: "user.teacher_availability_topics",
      foreignKey: "topic_id",
      otherKey: "availability_id",
      as: "teacherAvailability",
    });
  }

  if (!Teachertopicstats.associations?.feedbacks) {
    Teachertopicstats.hasMany(Feedback, {
      foreignKey: "bridger_id",
      sourceKey: "teacherId",
      as: "feedbacks",
      constraints: false
    });
  }
  if (!Feedback.associations?.teacherStats) {
    Feedback.belongsTo(Teachertopicstats, {
      foreignKey: "bridger_id",
      targetKey: "teacherId",
      as: "teacherStats",
      constraints: false
    });
  }

  if (!Test.associations?.user) {
    Test.belongsTo(User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  }
  if (!User.associations?.tests) {
    User.hasMany(Test, {
      foreignKey: "user_id",
      as: "tests",
      onDelete: "CASCADE",
    });
  }
};

export default defineRelationships;
