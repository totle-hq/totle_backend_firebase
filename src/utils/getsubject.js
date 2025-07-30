import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";

export const findSubjectAndDomain = async (topicId) => {
  let current = await CatalogueNode.findByPk(topicId);
  let subject = null;
  let domain = null;

  while (current?.parent_id) {
    const parent = await CatalogueNode.findByPk(current.parent_id);

    if (parent?.is_subject && !subject) {
      subject = { id: parent.node_id, name: parent.name };
    }

    if (parent?.is_domain && !domain) {
      domain = { id: parent.node_id, name: parent.name };
    }

    if (subject && domain) break;

    current = parent;
  }

  return { subject, domain };
};
