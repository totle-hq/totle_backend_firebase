
export const SupportQueryForUser = async (req, res) => {

    try {
    const {
      user_id = null,
      query_id,
      short_text,
      description,
    } = req.body;

    console.log("Received support query:", req.body);
    if (!query_id || !short_text) {
      return res.status(400).json({ error: "query_id and short_text are required." });
    }

    const newQuery = await SupportQuery.create({
      user_id,
      query_id,
      short_text,
      description,
      priority,
      status: 'open',
    });

    res.status(201).json({ message: "Query submitted successfully", query: newQuery });
  } catch (err) {
    console.error("Failed to submit support query:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}