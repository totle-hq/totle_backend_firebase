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
import { FeedbackSummary } from "../Models/feedbacksummary.js";
import { Role } from "../Models/UserModels/Roles.Model.js";
import { PresentNodeStats } from "../Models/analytics/PresentNodeStatsmodel.js";
// import { Category } from "../Models/CatalogModels/CategoryModel.js";
// import { Grade } from "../Models/CatalogModels/GradeModel.js";
// import { Subject } from "../Models/CatalogModels/SubjectModel.js";
// import { Topic } from "../Models/CatalogModels/TopicModel.js";
// import { Board } from "../Models/CatalogModels/BoardModel.js";
// import { Education } from "../Models/CatalogModels/EducationModel.js";
// import { Subtopic } from "../Models/CatalogModels/SubTopic.Model.js";


const defineRelationships = () => {
  // User to Response Relationship
  User.hasMany(Responses, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Responses.belongsTo(User, { foreignKey: 'userId' });

  // User to Preferred Language Relationship
  // User.belongsTo(Language, { foreignKey: "preferred_language_id", as: "preferredLanguage" });
  // Language.hasMany(User, { foreignKey: "preferred_language_id", as: "users" });


  // User to UserMetrics Relationship
  User.hasOne(UserMetrics, { foreignKey: 'userId', onDelete: 'CASCADE' });
  UserMetrics.belongsTo(User, { foreignKey: 'userId' });

  // Survey to Question Relationship
  Survey.hasMany(Question, { foreignKey: 'surveyId', as: "questions" });
  Question.belongsTo(Survey, { foreignKey: 'surveyId' });

  // Survey to Response Relationship
  Survey.hasMany(Responses, { foreignKey: 'surveyId' });
  Responses.belongsTo(Survey, { foreignKey: 'surveyId' });
  Responses.belongsTo(Question, {foreignKey:'questionId'});

  // Admin to Blog Relationship
  Admin.hasMany(Blog, { foreignKey: 'adminId' });
  Blog.belongsTo(Admin, { foreignKey: 'adminId' });

  Admin.hasMany(Survey, { foreignKey: "adminId" });
  Survey.belongsTo(Admin, { foreignKey: "adminId" });

  
  User.hasMany(OTP, { foreignKey: 'userId', onDelete: 'CASCADE' });
  OTP.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(MarketplaceSuggestion, { foreignKey: "userId", onDelete: 'CASCADE' });
  MarketplaceSuggestion.belongsTo(User, { foreignKey: "userId" });

  // ✅ Admin Access to Marketplace Suggestions (Indirect Access)
  Admin.hasMany(MarketplaceSuggestion, { foreignKey: "adminId", allowNull: true });

  Admin.hasMany(UserDepartment, { foreignKey: 'userId' });
  UserDepartment.belongsTo(Admin, { foreignKey: 'userId' });

  Admin.hasMany(RoleAssignmentLog, { foreignKey: 'userId' });
  RoleAssignmentLog.belongsTo(Admin, { foreignKey: 'userId' });

  Department.hasMany(UserDepartment, { foreignKey: 'departmentId' });
  UserDepartment.belongsTo(Department, { foreignKey: 'departmentId' });

  Teachertopicstats.belongsTo(User, { foreignKey: "teacherId", as: "teacher", onDelete: "CASCADE" });
  User.hasMany(Teachertopicstats, { foreignKey: "teacherId", as: "topicStats", onDelete: "CASCADE" });

  Teachertopicstats.belongsTo(CatalogueNode, { foreignKey: 'node_id', onDelete: 'CASCADE' });
  CatalogueNode.hasMany(Teachertopicstats, { foreignKey: 'node_id', onDelete: 'CASCADE' });
    
  FeedbackSummary.belongsTo(CatalogueNode,{foreignKey:'node_id', onDelete:'CASCADE'});
  CatalogueNode.hasMany(FeedbackSummary,{foreignKey:'node_id', onDelete:'CASCADE'});
  
  TestFlag.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  User.hasMany(TestFlag, { foreignKey: 'user_id', as: 'testFlags' });

PresentNodeStats.belongsTo(CatalogueNode, { foreignKey: 'node_id', as: 'node', onDelete: 'CASCADE' });
CatalogueNode.hasMany(PresentNodeStats, { foreignKey: 'node_id',  as: 'presentStats', onDelete: 'CASCADE'});

  TestFlag.belongsTo(Test, { foreignKey: 'test_id', as: 'test' });
  Test.hasMany(TestFlag, { foreignKey: 'test_id', as: 'flags' });
  SupportQueriesModel.belongsTo(User, {foreignKey: "user_id", onDelete: "CASCADE"});
  User.hasMany(SupportQueriesModel, {foreignKey: "user_id", onDelete: "CASCADE"});

  Department.hasMany(Department, { foreignKey: 'parentId', as: 'subDepartments', onDelete: 'CASCADE'});

  Department.belongsTo(Department, { foreignKey: 'parentId', as: 'parentDepartment'});

  Department.hasMany(Role, { foreignKey: 'departmentId', onDelete: 'CASCADE' });
  Role.belongsTo(Department, { foreignKey: 'departmentId', onDelete: 'CASCADE' });

  Session.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });
  User.hasMany(Session, { foreignKey: 'teacher_id', as: 'teachingSessions'});

  Session.belongsTo(CatalogueNode, { foreignKey: 'topic_id', onDelete: 'CASCADE' });
  CatalogueNode.hasMany(Session, { foreignKey: 'topic_id', onDelete: 'CASCADE' });


  BookedSession.belongsTo(User, { foreignKey: 'learner_id', as: 'student', onDelete: 'CASCADE' });
  CatalogueNode.belongsTo(CatalogueNode, { foreignKey: 'parent_id', as: 'parentNode', onDelete: 'CASCADE' });

  CatalogueNode.belongsTo(CatalogueNode, { as: "subject", foreignKey: "parent_id", onDelete: "CASCADE" });

  BookedSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacher_id', onDelete: 'CASCADE' });

  BookedSession.belongsTo(CatalogueNode, { as: 'bookedTopic', foreignKey: 'topic_id', onDelete: 'CASCADE' });
  CatalogueNode.hasMany(BookedSession, { foreignKey: 'topic_id', onDelete: 'CASCADE' });


  


};

export default defineRelationships