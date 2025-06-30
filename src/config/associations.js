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
import { Category } from "../Models/CatalogModels/CategoryModel.js";
import { Grade } from "../Models/CatalogModels/GradeModel.js";
import { Subject } from "../Models/CatalogModels/SubjectModel.js";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { Board } from "../Models/CatalogModels/BoardModel.js";
import { Education } from "../Models/CatalogModels/EducationModel.js";
import { Subtopic } from "../Models/CatalogModels/SubTopic.Model.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { ModerationFlag } from "../Models/moderatonflagsModel.js";
import { Session } from "../Models/SessionModel.js";
import { TeachResource } from "../Models/TeachResourceModel.js";


const defineRelationships = () => {
  // User to Response Relationship
  User.hasMany(Responses, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Responses.belongsTo(User, { foreignKey: 'userId' });

  // User to Preferred Language Relationship
  User.belongsTo(Language, { foreignKey: "preferred_language_id", as: "preferredLanguage" });
  Language.hasMany(User, { foreignKey: "preferred_language_id", as: "users" });


  // User to UserMetrics Relationship
  User.hasOne(UserMetrics, { foreignKey: 'userId', onDelete: 'CASCADE' });
  UserMetrics.belongsTo(User, { foreignKey: 'userId' });

  // Survey to Question Relationship
  Survey.hasMany(Question, { foreignKey: 'surveyId', as: "questions" });
  Question.belongsTo(Survey, { foreignKey: 'surveyId' });

  // Survey to Response Relationship
  Survey.hasMany(Responses, { foreignKey: 'surveyId' });
  Responses.belongsTo(Survey, { foreignKey: 'surveyId' });
  Responses.belongsTo(Question, {foreignKey:'questionId', as: "questions" });

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

  // Define the relationship between College and Category
  Education.belongsTo(Category, { foreignKey: 'parent_id', onDelete: "CASCADE"  });
  Category.hasMany(Education, { foreignKey: 'parent_id' });

  // Define the realtionship between session and user
Session.belongsTo(User, { foreignKey: "teacher_id", as: "teacher" });
User.hasMany(Session, { foreignKey: "teacher_id", as: "sessions" });
Session.belongsTo(User, { foreignKey: "student_id", as: "student" });
User.hasMany(Session, { foreignKey: "student_id", as: "learningSessions" });
// Define the relationship between the topic and teachertopic stat
Teachertopicstats.belongsTo(Topic, { foreignKey: 'topicId' });
Topic.hasMany(Teachertopicstats, { foreignKey: 'topicId' });

// Define the relationship between the topic and session
Session.belongsTo(Topic, { foreignKey: 'topic_id' });
Topic.hasMany(Session, { foreignKey: 'topic_id' });

// TeachResource → Topic
TeachResource.belongsTo(Topic, { foreignKey: "topic_id" });
Topic.hasMany(TeachResource, { foreignKey: "topic_id" });
// TeachResource → User
// TeacherTopicStats → belongs to a User (teacher)
Teachertopicstats.belongsTo(User, { foreignKey: "teacherId", as: "teacher" });
User.hasMany(Teachertopicstats, { foreignKey: "teacherId", as: "topicStats" });

TeachResource.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });
User.hasMany(TeachResource, { foreignKey: 'teacher_id', as: 'resources' });
// session → flags
Session.hasMany(ModerationFlag, { foreignKey: "session_id" });
ModerationFlag.belongsTo(Session, { foreignKey: "session_id" });

// user → flags
User.hasMany(ModerationFlag, { foreignKey: "reporter_id" });
ModerationFlag.belongsTo(User, { foreignKey: "reporter_id" });

  // Define the relationship between Board and School
  Board.belongsTo(Education, { foreignKey: 'parent_id' });
  Education.hasMany(Board, { foreignKey: 'parent_id' , onDelete: "CASCADE" });

  Board.hasMany(Grade, { foreignKey: 'parent_id', onDelete: 'CASCADE' });
  Grade.belongsTo(Board, { foreignKey: 'parent_id'});

  // Define the relationship between Grade and School
  // Grade.belongsTo(Education, { foreignKey: 'parent_id' });
  // Education.hasMany(Grade, { foreignKey: 'parent_id' });

  // Define the relationship between Subject and Grade
  Subject.belongsTo(Grade, { foreignKey: 'parent_id' });
  Grade.hasMany(Subject, { foreignKey: 'parent_id' , onDelete: "CASCADE" });

  // Define the relationship between Topic and Subject
  Topic.belongsTo(Subject, { foreignKey: 'parent_id' });
  Subject.hasMany(Topic, { foreignKey: 'parent_id', onDelete: "CASCADE", hooks: true,  });

  Subtopic.belongsTo(Topic, { foreignKey: 'parent_id' });
  Topic.hasMany(Subtopic, { foreignKey: 'parent_id', onDelete: "CASCADE" });
};

export default defineRelationships;
