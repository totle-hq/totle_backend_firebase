// Models/index.js
import { Session } from "./SessionModel.js";
import { User } from "./UserModels/UserModel.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";
import { CpsProfile } from "./CpsProfile.model.js"; // ✅ NEW

// For teacher info
Session.belongsTo(User, { as: "teacher", foreignKey: "teacher_id" });

// For topic info
Session.belongsTo(CatalogueNode, { as: "topic", foreignKey: "topic_id" });

// ✅ CPS association: one row per user in "user.cps_profiles"
User.hasOne(CpsProfile, { foreignKey: "user_id", as: "cpsProfile" });
CpsProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

// (Optional) export if you import from here elsewhere
export { Session, User, CatalogueNode, CpsProfile };
