import { SupportQueriesModel } from "../../Models/SupportModels/SupportQueriesModel.js";

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
    console.log("Decoded user ID:", decoded.id);

    // Validate required fields
    if (!query_id || !short_text) {
      return res
        .status(400)
        .json({ error: "query_id and short_text are required." });
    }

    const newQuery = await SupportQueriesModel.create({
      user_id: decoded.id,
      query_id,
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
