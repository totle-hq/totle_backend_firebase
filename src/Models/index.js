// src/Models/index.js
// -----------------------------------------------------------------------------
// Centralized Model Association Loader
// -----------------------------------------------------------------------------

import { Session } from "./SessionModel.js";
import { User } from "./UserModels/UserModel.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { CpsProfile } from "./CpsProfile.model.js";

// IQ Test models
import { IQQuestion } from "./CpsModels/IQQuestion.model.js";
import { IQChoice } from "./CpsModels/IQChoice.model.js";
import { IQRubric } from "./CpsModels/IQRubric.model.js";

// -----------------------------------------------------------------------------
// Utility: safe association checker
// -----------------------------------------------------------------------------
const hasAssoc = (Model, alias) => !!Model.associations?.[alias];

// -----------------------------------------------------------------------------
// SESSION ↔ USER ↔ TOPIC RELATIONSHIPS
// -----------------------------------------------------------------------------

// Session → User (teacher & student)
if (!hasAssoc(Session, "teacher")) {
  Session.belongsTo(User, { as: "teacher", foreignKey: "teacher_id" });
}
if (!hasAssoc(Session, "student")) {
  Session.belongsTo(User, { as: "student", foreignKey: "student_id" });
}

// Session → CatalogueNode (topic)
if (!hasAssoc(Session, "topic")) {
  Session.belongsTo(CatalogueNode, { as: "topic", foreignKey: "topic_id" });
}

// User → Sessions (teaching / attending)
if (!hasAssoc(User, "taughtSessions")) {
  User.hasMany(Session, { foreignKey: "teacher_id", as: "taughtSessions" });
}
if (!hasAssoc(User, "attendedSessions")) {
  User.hasMany(Session, { foreignKey: "student_id", as: "attendedSessions" });
}

// -----------------------------------------------------------------------------
// CPS PROFILE RELATIONSHIPS
// -----------------------------------------------------------------------------
if (!hasAssoc(User, "cpsProfile")) {
  User.hasOne(CpsProfile, { foreignKey: "user_id", as: "cpsProfile" });
}
if (!hasAssoc(CpsProfile, "user")) {
  CpsProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });
}

// -----------------------------------------------------------------------------
// IQ TEST RELATIONSHIPS
// -----------------------------------------------------------------------------

// Question → Choices
if (!hasAssoc(IQQuestion, "choices")) {
  IQQuestion.hasMany(IQChoice, {
    as: "choices",
    foreignKey: "questionId",
    sourceKey: "id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    hooks: true,
  });
}
if (!hasAssoc(IQChoice, "question")) {
  IQChoice.belongsTo(IQQuestion, {
    as: "question",
    foreignKey: "questionId",
    targetKey: "id",
  });
}

// Choice → Rubrics
if (!hasAssoc(IQChoice, "rubrics")) {
  IQChoice.hasMany(IQRubric, {
    as: "rubrics",
    foreignKey: "choiceId",
    sourceKey: "id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    hooks: true,
  });
}
if (!hasAssoc(IQRubric, "choice")) {
  IQRubric.belongsTo(IQChoice, {
    as: "choice",
    foreignKey: "choiceId",
    targetKey: "id",
  });
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------
export {
  Session,
  User,
  CatalogueNode,
  CpsProfile,
  IQQuestion,
  IQChoice,
  IQRubric,
};
