import { SupportQueryMaster } from "../../Models/SupportModels/SupportQueriesMaster.js";
import { SupportQueriesModel } from "../../Models/SupportModels/SupportQueriesModel.js";
import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { Sequelize } from "sequelize";

export const SupportQueryForUser = async (req, res) => {
  try {
    const {
      query_id,
      short_text,
      description,
    } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("Decoded user ID:", decoded.id);
    const query = await SupportQueryMaster.findOne({ where: { id: query_id } });
    // Validate required fields
    if (!query_id || !short_text) {
      return res
        .status(400)
        .json({ error: "query_id and short_text are required." });
    }

    const newQuery = await SupportQueriesModel.create({
      user_id: decoded.id,
      query_id,
      query_type: query ? query.name : null, // Use query name if exists
      short_text,
      description,
      status: "pending",
    });

    res
      .status(201)
      .json({ message: "Query submitted successfully", query: newQuery });
  } catch (err) {
    console.error("Failed to submit support query:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getSupportQueries = async (req, res) => {
  try {
    const queries = await SupportQueriesModel.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "email"], // adjust fields as needed
        },
      ],
      order: [["created_at", "DESC"]],
    });

    if (!queries || queries.length === 0) {
      return res.status(404).json({ message: "No support queries found." });
    }

    res.status(200).json(queries);
  } catch (err) {
    console.error("Failed to fetch support queries:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getQueriesList = async (req, res) => {
  try {
    const queries = await SupportQueryMaster.findAll({
      attributes: ["id", "name"],
      order: [["created_at", "DESC"]],
    });

    if (!queries || queries.length === 0) {
      return res.status(404).json({ message: "No support queries found." });
    }

    res.status(200).json(queries);
  } catch (err) {
    console.error("Failed to fetch support queries list:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const updateQueryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!id || !status) {
      return res.status(400).json({ error: "queryId and status are required." });
    }

    const validStatuses = ["pending","inProgress", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const query = await SupportQueriesModel.findByPk(id);
    if (!query) {
      return res.status(404).json({ error: "Query not found." });
    }
    query.status = status;
    await query.save();
    res.status(200).json({ message: "Query status updated successfully", query });
  } catch (err) {
    console.error("Failed to update query status:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateQueryPriority = async (req, res) => {
  try {
    const { priority } = req.body;
    const { id } = req.params;

    if (!id || !priority) {
      return res.status(400).json({ error: "queryId and status are required." });
    }

    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority value." });
    }

    const query = await SupportQueriesModel.findByPk(id);
    if (!query) {
      return res.status(404).json({ error: "Query not found." });
    }
    query.priority = priority;
    await query.save();
    res.status(200).json({ message: "Query priority updated successfully", query });
  } catch (err) {
    console.error("Failed to update query priority:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const countQueriesByStatus = async (req, res) => {
  try {
    const counts = await SupportQueriesModel.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: 'status',
      raw: true
    });

    // Convert to summary format
    const summary = {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
    };

    for (const row of counts) {
      summary.total += parseInt(row.count, 10);
      if (row.status === 'pending') summary.pending = parseInt(row.count, 10);
      if (row.status === 'inProgress') summary.inProgress = parseInt(row.count, 10);
      if (row.status === 'resolved') summary.resolved = parseInt(row.count, 10);
    }

    res.status(200).json(summary);
  } catch (err) {
    console.error("Failed to count queries by status:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
