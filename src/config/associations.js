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
  Survey.hasMany(Question, { foreignKey: 'surveyId' });
  Question.belongsTo(Survey, { foreignKey: 'surveyId' });

  // Survey to Response Relationship
  Survey.hasMany(Responses, { foreignKey: 'surveyId' });
  Responses.belongsTo(Survey, { foreignKey: 'surveyId' });

  // Admin to Blog Relationship
  Admin.hasMany(Blog, { foreignKey: 'adminId' });
  Blog.belongsTo(Admin, { foreignKey: 'adminId' });

  Admin.hasMany(Survey, { foreignKey: "adminId" });
  Survey.belongsTo(Admin, { foreignKey: "adminId" });

  
  User.hasMany(OTP, { foreignKey: 'userId', onDelete: 'CASCADE' });
  OTP.belongsTo(User, { foreignKey: 'userId' });
};

export default defineRelationships;
