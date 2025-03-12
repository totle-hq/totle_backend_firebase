// config/associations.js
import { Admin } from "../Models/AdminModel.js";
import { Blog } from "../Models/BlogModel.js";
import { Language } from "../Models/LanguageModel.js";
import { Responses } from "../Models/ResponsesModel.js";
import { Survey } from "../Models/SurveyModel.js";
import { User } from "../Models/UserModel.js";
import { UserMetrics } from "../Models/UserMetricsModel.js";
import { Question } from "../Models/QuestionModel.js";
import { OTP } from "../Models/OtpModel.js";
import { MarketplaceSuggestion } from "../Models/MarketplaceModel.js";
import { School } from "../Models/SchoolModel.js";
import { Category } from "../Models/CategoryModel.js";
import { College } from "../Models/CollegeModel.js";
import { ICSEBoard } from "../Models/ICSEboardModel.js";
import { CBSEBoard } from "../Models/CBSEboardModel.js";
import { Grade } from "../Models/GradeModel.js";
import { Subject } from "../Models/SubjectModel.js";
import { Topic } from "../Models/TopicModel.js";


const defineRelationships = () => {
  // User to Response Relationship
  User.hasMany(Responses, { foreignKey: 'userId' });
  Responses.belongsTo(User, { foreignKey: 'userId' });

  // User to Preferred Language Relationship
  User.belongsTo(Language, { foreignKey: "preferred_language_id", as: "preferredLanguage" });
  Language.hasMany(User, { foreignKey: "preferred_language_id", as: "users" });


  // User to UserMetrics Relationship
  User.hasOne(UserMetrics, { foreignKey: 'userId' });
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

  User.hasMany(MarketplaceSuggestion, { foreignKey: "userId" });
  MarketplaceSuggestion.belongsTo(User, { foreignKey: "userId" });

  // ✅ Admin Access to Marketplace Suggestions (Indirect Access)
  Admin.hasMany(MarketplaceSuggestion, { foreignKey: "adminId", allowNull: true });


  // Define the relationship
  School.belongsTo(Category, { foreignKey: 'categoryId' });
  Category.hasMany(School, { foreignKey: 'categoryId' });

  // Define the relationship between College and Category
  College.belongsTo(Category, { foreignKey: 'categoryId' });
  Category.hasMany(College, { foreignKey: 'categoryId' });

  // Define the relationship between ICSEBoard and School
  ICSEBoard.belongsTo(School, { foreignKey: 'schoolId' });
  School.hasMany(ICSEBoard, { foreignKey: 'schoolId' });
  // Define the relationship between CBSEBoard and School
  CBSEBoard.belongsTo(School, { foreignKey: 'schoolId' });
  School.hasMany(CBSEBoard, { foreignKey: 'schoolId' });

  // Define the relationship between Grade and School
  Grade.belongsTo(School, { foreignKey: 'schoolId' });
  School.hasMany(Grade, { foreignKey: 'schoolId' });

  // Define the relationship between Subject and Grade
  Subject.belongsTo(Grade, { foreignKey: 'gradeId' });
  Grade.hasMany(Subject, { foreignKey: 'gradeId' });

  // Define the relationship between Topic and Subject
  Topic.belongsTo(Subject, { foreignKey: 'subjectId' });
  Subject.hasMany(Topic, { foreignKey: 'subjectId' });
};

export default defineRelationships;
