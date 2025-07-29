import UserDomainProgress from "../Models/progressModels.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";

export const createUserDomainProgress = async (req, res) => {
  try {
    const { user_id, domain_id, motivation, goal } = req.body;

    // Get domain node
    const domainNode = await CatalogueNode.findOne({
      where: { node_id: domain_id, is_domain: true },
    });

    if (!domainNode) {
      return res.status(404).json({ error: "Domain not found" });
    }

    // Fetch subjects under the domain
    const subjectNodes = await CatalogueNode.findAll({
      where: { parent_id: domain_id, status: "active" },
    });
    console.log("Subject Nodes:", subjectNodes);

    // For each subject, fetch its topics
    const subjectsWithTopics = await Promise.all(
      subjectNodes.map(async (subject) => {
        const topics = await CatalogueNode.findAll({
          where: { parent_id: subject.node_id, status: "active" },
        });

        return {
          subject_id: subject.node_id,
          subject_name: subject.name,
          topics: topics.map((topic) => ({
            topic_id: topic.node_id,
            topic_name: topic.name,
          })),
        };
      })
    );
    // Upsert user progress
    const [userProgress, created] = await UserDomainProgress.upsert(
      {
        user_id,
        domain_id,
        domain_name: domainNode.name,
        subjects: subjectsWithTopics, 
        hierarchy_path: domainNode.address_of_node, // Use address_of_node for hierarchy path
        motivation: motivation || "",
        goal: goal || "",
        topics_completed: [],
        completed_by_self: [],
        completed_by_totle: [],
      },
      { returning: true }
    );

    return res.status(200).json({
      message: created ? "Progress created" : "Progress updated",
      data: userProgress,
    });
  } catch (error) {
    console.error("Error in createUserDomainProgress:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllUserDomainProgress = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const userProgress = await UserDomainProgress.findAll({
      where: { user_id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      data: userProgress.map((progress) => ({
        progress_id: progress.id,
        domain_id: progress.domain_id,
        domain_name: progress.domain_name,
        subjects: progress.subjects, // already nested
        hierarchy_path: progress.hierarchy_path,
        motivation: progress.motivation,
        goal: progress.goal,
        topics_completed: progress.topics_completed,
        completed_by_self: progress.completed_by_self,
        completed_by_totle: progress.completed_by_totle,
      })),
    });
  } catch (error) {
    console.error("Error in getAllUserDomainProgress:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getDomain = async (req, res) => {
  try {
    const matchedDomains = await CatalogueNode.findAll({
      where: {
        is_domain: true,
      },
      attributes: ['node_id', 'name', 'address_of_node']
    });

    return res.status(200).json({ domains: matchedDomains });
  } catch (err) {
    console.error("Error in getDomain:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const updateUserDomainProgress = async (req, res) => {
  try {
    const {
      user_id,
      domain_id,
      completed_by_self = [],
      completed_by_totle = [],
    } = req.body;

    if (!user_id || !domain_id) {
      return res.status(400).json({ error: "Missing required user or domain ID" });
    }

    const progress = await UserDomainProgress.findOne({
      where: { user_id, domain_id },
    });

    if (!progress) {
      return res.status(404).json({ error: "Progress record not found" });
    }

    
    const topics_completed = Array.from(
      new Set([...completed_by_self, ...completed_by_totle])
    );

    await progress.update({
      completed_by_self,
      completed_by_totle,
      topics_completed,
    });

    res.status(200).json({ message: "Progress updated", data: progress });
  } catch (error) {
    console.error("Error in updateUserDomainProgress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const deleteUserDomainProgress = async (req, res) => {
  try {
    const { user_id, domain_id } = req.query;

    if (!user_id || !domain_id) {
      return res.status(400).json({ message: "user_id and domain_id are required." });
    }

    const deleted = await UserDomainProgress.destroy({
      where: { user_id, domain_id },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: "Progress record not found." });
    }

    return res.status(200).json({ message: "Progress record deleted successfully." });
  } catch (error) {
    console.error("Error in deleteUserDomainProgress:", error);
    return res.status(500).json({ message: "Server error." });
  }
};
