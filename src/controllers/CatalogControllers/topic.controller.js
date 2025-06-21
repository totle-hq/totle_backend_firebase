import { Subject } from "../../Models/CatalogModels/SubjectModel.js";
import { Topic } from "../../Models/CatalogModels/TopicModel.js";


// ✅ Fetch all topics (excluding soft-deleted ones)
export const getAllTopics = async (req, res) => {
  try {
    const topics = await Topic.findAll();
    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

// ✅ Fetch a single topic by ID
export const getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findByPk(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    res.status(200).json(topic);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch topic" });
  }
};

// ✅ Fetch topics by Subject ID
export const getTopicsBySubject = async (req, res) => {
  try {
    const topics = await Topic.findAll({
      where: { subjectId: req.params.subjectId },
    });
    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

// ✅ Create a new topic
export const createTopic = async (req, res) => {
  try {
    const { name, description, subjectId } = req.body;

    // Check if Subject exists before creating Topic
    const subject = await Subject.findByPk(subjectId);
    if (!subject) return res.status(400).json({ error: "Invalid subject ID" });

    const newTopic = await Topic.create({ name, description, subjectId });
    res.status(201).json(newTopic);
  } catch (error) {
    res.status(500).json({ error: "Failed to create topic" });
  }
};

// ✅ Update an existing topic
export const updateTopic = async (req, res) => {
  try {
    const { name, description } = req.body;
    const topic = await Topic.findByPk(req.params.id);

    if (!topic) return res.status(404).json({ error: "Topic not found" });

    await topic.update({ name, description });
    res.status(200).json(topic);
  } catch (error) {
    res.status(500).json({ error: "Failed to update topic" });
  }
};

// ✅ Soft delete a topic
export const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findByPk(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    await topic.destroy(); // Soft delete
    res.status(200).json({ message: "Topic deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete topic" });
  }
};

// ✅ Restore a soft-deleted topic
export const restoreTopic = async (req, res) => {
  try {
    const topic = await Topic.findByPk(req.params.id, { paranoid: false });
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    await topic.restore(); // Restore soft-deleted topic
    res.status(200).json({ message: "Topic restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore topic" });
  }
};
