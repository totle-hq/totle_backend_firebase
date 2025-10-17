// src/Models/index.js
import { Session } from "./SessionModel.js";
import { User } from "./UserModels/UserModel.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { CpsProfile } from "./CpsProfile.model.js";

// IQ Test models
import { IQQuestion } from "./CpsModels/IQQuestion.model.js";
import { IQChoice } from "./CpsModels/IQChoice.model.js";
import { IQRubric } from "./CpsModels/IQRubric.model.js";

// helper to avoid double-adding same alias
const hasAssoc = (Model, alias) => !!Model.associations?.[alias];

// --- Session associations ---
if (!hasAssoc(Session, "teacher")) {
  Session.belongsTo(User, { as: "teacher", foreignKey: "teacher_id" });
}
if (!hasAssoc(Session, "topic")) {
  Session.belongsTo(CatalogueNode, { as: "topic", foreignKey: "topic_id" });
}

// --- CPS profile association ---
if (!hasAssoc(User, "cpsProfile")) {
  User.hasOne(CpsProfile, { foreignKey: "user_id", as: "cpsProfile" });
}
if (!hasAssoc(CpsProfile, "user")) {
  CpsProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });
}

// --- IQ Test associations ---
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

export { Session, User, CatalogueNode, CpsProfile, IQQuestion, IQChoice, IQRubric };
