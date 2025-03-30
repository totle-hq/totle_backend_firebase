// controllers/catalogueNode.controller.js
import { Category } from "../../Models/CategoryModel.js";
import { Education } from "../../Models/EducationModel.js";
import { Board } from "../../Models/BoardModel.js";
import { Grade } from "../../Models/GradeModel.js";
import { Subject } from "../../Models/SubjectModel.js";
import { Topic } from "../../Models/TopicModel.js";

export const createNode = async (req, res) => {
  const {
    node_type,
    name,
    description,
    parent_id,
    parent_name,
    status,
    is_domain,
    is_topic,
    session_count,
    average_session_count,
    prices,
    topic_params,
    prerequisites,
  } = req.body;

  // 🧼 Normalize parent_id to null if empty string is sent
  const cleanParentId = parent_id === "" ? null : parent_id;

  console.log("📥 Incoming node creation:", { node_type, cleanParentId, name });

  if (cleanParentId && Number(cleanParentId) === Number(req.body.id)) {
    return res.status(400).json({ error: "Node cannot be its own parent." });
  }

  try {
    let createdNode;

    switch (node_type) {
      case "Category":
        createdNode = await Category.create({
          name,
          description,
          parent_id: cleanParentId || null,
          parent_name: null,
        });
        break;

      case "Education": {
        const parent = await Category.findByPk(parent_id);
        if (!parent) return res.status(400).json({ error: "Invalid Category ID" });

        createdNode = await Education.create({
          name,
          description,
          parent_id: cleanParentId || null,
          parent_name: parent.name,
        });
        break;
      }

      case "Board": {
        const parent = await Education.findByPk(parent_id);
        if (!parent) return res.status(400).json({ error: "Invalid Education ID" });

        createdNode = await Board.create({
          name,
          description,
          parent_id: cleanParentId || null,
          parent_name: parent.name,
        });
        break;
      }

      case "Grade": {
        const parent = await Board.findByPk(parent_id);
        if (!parent) return res.status(400).json({ error: "Invalid Board ID" });

        createdNode = await Grade.create({
          name,
          description,
          parent_id: cleanParentId || null,
          parent_name: parent.name,
        });
        break;
      }

      case "Subject": {
        const parent = await Grade.findByPk(parent_id);
        if (!parent) return res.status(400).json({ error: "Invalid Grade ID" });

        createdNode = await Subject.create({
          name,
          description,
          parent_id: cleanParentId || null,
          parent_name: parent.name,
        });
        break;
      }

      case "Topic": {
        const parent = await Subject.findByPk(cleanParentId);
        if (!parent) return res.status(400).json({ error: "Invalid Subject ID" });

        createdNode = await Topic.create({
          name,
          description,
          parent_id: cleanParentId,
          parent_name: parent.name,
          status,
          is_topic,
          session_count,
          average_session_count: average_session_count || null,
          prices: prices || {},
          topic_params: topic_params || {},
          prerequisites: prerequisites || [],
        });
        break;
      }

      default:
        return res.status(400).json({ error: "Unsupported node_type" });
    }

    res.status(201).json({ message: `${node_type} created successfully`, data: createdNode });
  } catch (error) {
    console.error("createNode error:", error);
    res.status(500).json({ error: "Node creation failed", details: error.message });
  }
};

export const getNodes = async (req, res) => {
  const parentId = req.query.parent_id;
  const parentType = req.query.parent_type;

  try {
    let nodes = [];

    if (!parentId) {
      // Top-level nodes → return Categories
      const categories = await Category.findAll();
      nodes = categories.map((n) => ({
        ...n.toJSON(),
        node_type: "Category",
      }));
    } else {
      switch (parentType) {
        case "Category": {
          const education = await Education.findAll({ where: { parent_id: parentId } });
          nodes = education.map((n) => ({
            ...n.toJSON(),
            node_type: "Education",
          }));
          break;
        }
        case "Education": {
          const boards = await Board.findAll({ where: { parent_id: parentId } });
          nodes = boards.map((n) => ({
            ...n.toJSON(),
            node_type: "Board",
          }));
          break;
        }
        case "Board": {
          const grades = await Grade.findAll({ where: { parent_id: parentId } });
          nodes = grades.map((n) => ({
            ...n.toJSON(),
            node_type: "Grade",
          }));
          break;
        }
        case "Grade": {
          const subjects = await Subject.findAll({ where: { parent_id: parentId } });
          nodes = subjects.map((n) => ({
            ...n.toJSON(),
            node_type: "Subject",
          }));
          break;
        }
        case "Subject": {
          const topics = await Topic.findAll({ where: { parent_id: parentId } });
          console.log("📥 Fetched topics:", topics);
          nodes = topics.map((n) => ({
            ...n.toJSON(),
            node_type: "Topic",
          }));
          break;
        }
        default:
          return res.status(400).json({ error: "Invalid parent_type provided." });
      }
    }

    console.log("📤 Fetched nodes:", nodes);
    console.log("📥 Parent type:", parentType, "Parent ID:", parentId);
    res.json({ data: nodes });
  } catch (error) {
    console.error("❌ Failed to fetch nodes:", error);
    res.status(500).json({ error: "Failed to fetch nodes" });
  }
};


export const deleteNode = async (req, res) => {
  const { id } = req.params;

  try {

     // Check if this node has children in the next model
     const childChecks = [
      { model: Topic, foreignKey: "parent_id" },
      { model: Subject, foreignKey: "parent_id" },
      { model: Grade, foreignKey: "parent_id" },
      { model: Board, foreignKey: "parent_id" },
      { model: Education, foreignKey: "parent_id" },
    ];

    for (const { model, foreignKey } of childChecks) {
      const child = await model.findOne({ where: { [foreignKey]: id } });
      if (child) {
        return res.status(400).json({
          error: "Cannot delete node with children",
          child: child.name,
        });
      }
    }


    // Try deleting from every model (reverse order of hierarchy)
    const deleted =
      (await Topic.destroy({ where: { id } })) ||
      (await Subject.destroy({ where: { id } })) ||
      (await Grade.destroy({ where: { id } })) ||
      (await Board.destroy({ where: { id } })) ||
      (await Education.destroy({ where: { id } })) ||
      (await Category.destroy({ where: { id } }));

    if (!deleted) {
      return res.status(404).json({ error: "Node not found" });
    }

    res.status(200).json({ message: "Node deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Failed to delete node", details: error.message });
  }
};

export const updateNode = async (req, res) => {
  const { id } = req.params;
  const { node_type, ...rest } = req.body;

  console.log("🔄 Backend received PUT to update:", id, node_type, rest);
  

  console.log("🛠️ UPDATE NODE:", { id, node_type, rest }); 

  try {
    let model;

    switch (node_type) {
      case "Category": model = Category; break;
      case "Education": model = Education; break;
      case "Board": model = Board; break;
      case "Grade": model = Grade; break;
      case "Subject": model = Subject; break;
      case "Topic": model = Topic; break;
      default: return res.status(400).json({ error: "Invalid node_type" });
    }

    const updated = await model.update(rest, { where: { id } });

    res.json({ message: "Node updated", updated });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Failed to update node" });
  }
};
