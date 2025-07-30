import { Session } from "./SessionModel.js";
import { User } from "./UserModels/UserModel.js";
import { CatalogueNode } from "./CatalogModels/catalogueNode.model.js";

// For teacher info
Session.belongsTo(User, { as: 'teacher', foreignKey: 'teacher_id' });

// For topic info
Session.belongsTo(CatalogueNode, { as: 'topic', foreignKey: 'topic_id' });
