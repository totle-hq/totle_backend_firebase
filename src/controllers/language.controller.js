import { userDb } from "../config/prismaClient.js";

export const getLanguages = async (req, res) => {
  try {
    const languages = await userDb.language.findMany({
      select: {
        language_id: true,
        language_name: true,
      },
      orderBy: {
        language_name: "asc",
      },
    });
    res.status(200).json(languages);
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ error: true, message: "Failed to retrieve languages." });
  }
};

export const insertLanguages = async (req, res) => {
  try {
    await userDb.language.createMany({
      data: req.body,
      skipDuplicates: true,
    });
    res.status(200).json({ message: "✅ Languages inserted successfully." });
  } catch (error) {
    console.error("❌ Error inserting languages:", error);
    res.status(500).json({ error: true, message: "Error inserting languages." });
  }
};
