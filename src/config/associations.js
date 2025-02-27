// config/associations.js
import User from '../models/user';
import Admin from '../models/admin';
import Blog from '../models/blog';
import Survey from '../models/survey';
import Response from '../models/response';
import Language from '../models/language';
import OTP from '../models/OtpModel';
import Question from '../models/question';
import UserMetrics from '../models/userMetrics';

const defineRelationships = () => {
  // User to Response Relationship
  User.hasMany(Response, { foreignKey: 'userId' });
  Response.belongsTo(User, { foreignKey: 'userId' });

  // Survey to Response Relationship
  Survey.hasMany(Response, { foreignKey: 'surveyId' });
  Response.belongsTo(Survey, { foreignKey: 'surveyId' });

  // Admin to Blog Relationship
  Admin.hasMany(Blog, { foreignKey: 'adminId' });
  Blog.belongsTo(Admin, { foreignKey: 'adminId' });

  // User to Preferred Language Relationship
  User.belongsTo(Language, { foreignKey: 'preferred_language_id' });
  Language.hasMany(User, { foreignKey: 'preferred_language_id' });

  // Survey to Question Relationship
  Survey.hasMany(Question, { foreignKey: 'surveyId' });
  Question.belongsTo(Survey, { foreignKey: 'surveyId' });

  // User to UserMetrics Relationship
  User.hasOne(UserMetrics, { foreignKey: 'userId' });
  UserMetrics.belongsTo(User, { foreignKey: 'userId' });
};

export default defineRelationships;
