import express from "express";
import { Op } from "sequelize";
import { User } from "../../Models/UserModels/UserModel.js";
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import Session from "../../Models/SessionModel.js";
import { TeacherAvailability } from "../../Models/TeacherAvailability.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";

const router = express.Router();

/* ------------------------------------------------------------------
   Helper → Safely get last update timestamp from a model
------------------------------------------------------------------ */
const getLastUpdate = async (model) => {
  try {
    const record = await model.findOne({
      attributes: ["updatedAt"],
      order: [["updatedAt", "DESC"]],
      raw: true,
    });
    return record?.updatedAt ? new Date(record.updatedAt).toISOString().split("T")[0] : null;
  } catch (err) {
    console.warn(`⚠️ Could not get last update for ${model.name}:`, err.message);
    return null;
  }
};

/* ------------------------------------------------------------------
   Route: GET /generate-sitemap
------------------------------------------------------------------ */
router.get("/generate-sitemap", async (req, res) => {
  try {
    const baseUrl = process.env.NODE_ENV === "production" ? "https://totle.co" : "http://localhost:3000";
    

    // 🕒 Collect lastmod dates from key models
    const [
      userLast,
      attendanceLast,
      sessionLast,
      availabilityLast,
      catalogueLast,
    ] = await Promise.all([
      getLastUpdate(User),
      getLastUpdate(SessionAttendance),
      getLastUpdate(Session),
      getLastUpdate(TeacherAvailability),
      getLastUpdate(CatalogueNode),
    ]);

    // Compute homepage lastmod as latest among active models
    const homeLastMod = [
      userLast,
      attendanceLast,
      sessionLast,
      availabilityLast,
    ]
      .filter(Boolean)
      .sort()
      .reverse()[0] || new Date().toISOString().split("T")[0];

    /* ------------------ STATIC PAGES ------------------ */
    const staticPages = [
      { loc: "/", lastmod: homeLastMod, priority: "1.0" },
      { loc: "/about", lastmod: homeLastMod, priority: "0.9" },
      { loc: "/contact", lastmod: homeLastMod, priority: "0.9" },
      { loc: "/privacy-policy", lastmod: homeLastMod, priority: "0.8" },
      { loc: "/terms-and-conditions", lastmod: homeLastMod, priority: "0.8" },
      { loc: "/refund-policy", lastmod: homeLastMod, priority: "0.8" },
    ];

    /* ------------------ DYNAMIC PAGES ------------------ */
    const dynamicPages = [
      { loc: "/auth", lastmod: userLast, priority: "0.9" },
      { loc: "/teach", lastmod: userLast, priority: "0.9" },
      { loc: "/teach/my-sessions", lastmod: sessionLast, priority: "0.9" },
      { loc: "/teach/availability-chart", lastmod: availabilityLast, priority: "0.9" },
      { loc: "/teach/test-center", lastmod: catalogueLast, priority: "0.9" },
      { loc: "/learn", lastmod: sessionLast, priority: "0.9" },
      { loc: "/learn/my-session", lastmod: sessionLast, priority: "0.9" },
    ];

    // Combine all URLs
    const allUrls = [...staticPages, ...dynamicPages];

    // Build XML
    const xmlBody = allUrls
      .map(
        (u) => `
      <url>
        <loc>${baseUrl}${u.loc}</loc>
        <lastmod>${u.lastmod || new Date().toISOString().split("T")[0]}</lastmod>
        <priority>${u.priority}</priority>
      </url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlBody}
    </urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("❌ Error generating sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
});

export default router;
