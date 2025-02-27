// import { userDb } from "../config/prismaClient.js";
import {Language} from "../Models/LanguageModel.js"

export const getLanguages = async (req, res) => {
  try {
    const languages = await Language.findAll({
      order: [['language_name', 'ASC']],
    });
    res.status(200).json(languages);
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ error: true, message: "Failed to retrieve languages." });
  }
};

export const insertLanguages = async (req, res) => {
  try {
    const languages = [
      "Assamese", "Bengali", "Bodo", "Dogri", "English",
      "Gujarati", "Hindi", "Kannada", "Kashmiri", "Konkani",
      "Maithili", "Malayalam", "Manipuri", "Marathi", "Nepali",
      "Odia", "Punjabi", "Sanskrit", "Santali", "Sindhi",
      "Tamil", "Telugu", "Urdu", "Bhili", "Gondi", "Tulu"
    ];
    let languageData = languages.map((language) => ({ language_name: language }));
    await Language.bulkCreate(languageData, { validate: true });
    res.status(200).json({ message: "✅ Languages inserted successfully." });
  } catch (error) {
    console.error("❌ Error inserting languages:", error);
    res.status(500).json({ error: true, message: "Error inserting languages." });
  }
};
