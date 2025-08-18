import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";

export const getCatalogueChildrenUpToDomain = async (req, res) => {
  try {
    const parentId = req.query.parentId || null;

    const children = await CatalogueNode.findAll({
      where: { parent_id: parentId },
      order: [["created_at", "DESC"]],
      attributes: [
        "node_id",
        "name",
        "description",
        "is_domain",
        "status",
        "session_count",
        "prices",
        "metadata",
        "created_at",
        "updated_at",
      ],
    });

    const hasDomain = children.some((node) => node.is_domain === true);

    if (hasDomain) {
      return res.status(200).json({ message: "No projects available yet." });
    }

    return res.status(200).json({ data: children });
  } catch (error) {
    console.error("Error in getCatalogueChildrenUpToDomain:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
