import { SupportQueryMaster } from "../../Models/SupportModels/SupportQueriesMaster.js";
import { SupportQueriesModel } from "../../Models/SupportModels/SupportQueriesModel.js";
import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";

export const SupportQueryForUser = async (req, res) => {
  try {
    const {
      query_id,
      short_text,
      description,
      priority, // allow null
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
      priority: priority ?? null, // explicit null if not provided
      status: "open",
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
    const { query_id } = req.query;

    if (!query_id) {
      return res.status(400).json({ error: "query_id is required" });
    }

    const queries = await SupportQueriesModel.findAll({
      where: { query_id },
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
