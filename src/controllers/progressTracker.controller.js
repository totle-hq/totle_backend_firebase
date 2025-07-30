import UserDomainProgress from "../Models/progressModels.js";

export const getAllUserDomainProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const progress = await UserDomainProgress.findAll({
      where: {
        user_id: id,
      },
    });

    if (!progress || progress.length === 0) {
      return res
        .status(404)
        .json({ message: "No progress entries found for the given user ID" });
    }

    return res.status(200).json(progress);
  } catch (error) {
    console.error("Error fetching user domain progress:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createUserDomainProgress = async (req, res) => {
  try {
    const {
      user_id,
      subject_id,
      subject_name,
      topic_ids,
      topic_names,
      topics_completed,
      hierarchy_path,
      motivation,
      goal,
    } = req.body;

    // Basic validation
    if (
      !user_id ||
      !subject_id ||
      !subject_name ||
      !Array.isArray(topic_ids) ||
      !Array.isArray(topic_names) ||
      topic_ids.length !== topic_names.length
    ) {
      return res.status(400).json({
        message:
          "Required fields missing or mismatched topic_ids and topic_names.",
      });
    }

    const progress = await UserDomainProgress.create({
      user_id,
      subject_id,
      subject_name,
      topic_ids,
      topic_names,
      topics_completed: topics_completed || [],
      hierarchy_path: hierarchy_path || [],
      motivation,
      goal,
    });

    return res.status(201).json(progress);
  } catch (err) {
    console.error("Error in createUserDomainProgress:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUserDomainProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const progress = await UserDomainProgress.findByPk(id);
    if (!progress) {
      return res.status(404).json({ message: "Progress entry not found" });
    }

    await progress.update(updates);
    return res.status(200).json(progress);
  } catch (error) {
    console.error("Error updating progress:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteUserDomainProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const progress = await UserDomainProgress.findByPk(id);
    if (!progress) {
      return res.status(404).json({ message: "Progress entry not found" });
    }

    await progress.destroy();
    return res
      .status(200)
      .json({ message: "Progress entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting progress:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};