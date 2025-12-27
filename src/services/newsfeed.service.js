import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Step 1: Fetch raw articles from NewsAPI
 */
async function fetchRawArticles() {
  const query = encodeURIComponent(
    "education OR edtech OR 'online learning' OR 'higher education' OR university OR 'student mobility' OR 'skills development' OR 'startup funding' OR 'AI in education' OR 'AI policy' OR 'finance in edtech' OR 'HR policy' OR 'legal compliance' OR 'marketing strategy'"
  );

  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;

  const { data } = await axios.get(url);

  // console.log(`📡 [newsfeed] Raw fetch → ${data.articles.length} articles`);

  return data.articles.map((a, idx) => ({
    id: `news-${idx}-${Date.now()}`,
    title: a.title,
    summary: a.description || "",
    url: a.url,
    source: a.source?.name || "Unknown",
    content: a.content || "",
  }));
}

/**
 * Step 2: Filter out totally irrelevant articles
 */
function prefilterArticles(articles) {
  const keywords = [
    "education", "edtech", "learning", "university", "student", "teacher",
    "ai", "artificial intelligence", "finance", "funding", "startup",
    "policy", "regulation", "hr", "human resources", "legal", "compliance",
    "marketing", "strategy", "operations"
  ];

  const filtered = articles.filter((a) => {
    const text = `${a.title} ${a.summary} ${a.content}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });

  return filtered;
}

/**
 * Step 3: Use OpenAI to classify & score relevance
 */
async function processWithAI(articles) {
  if (!articles.length) return [];

  const prompt = `
You are a TOTLE news relevance classifier.

Departments: Echo (Marketing), Tenjiku (Research), Manhattan (Tech), Helix (Operations),
Vault (Finance), Legion (Legal), Sentinel (Support), Haven (HR), Kyoto (Strategy), Global.

Roles: Founder, Superadmin, Department Head, Senior Project Manager, Project Manager, Contributor, Watcher, Intern.

For EACH input article, return a JSON array (same length, same order) where every object has:
{
  "department": "string (one of the 9 departments or Global)",
  "roles": ["array of impacted roles"],
  "importance": number (0–100),
  "relevance": number (0–100),
  "summary": "1–2 sentence summary"
}
Return ONLY valid JSON, nothing else.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You classify authentic news for TOTLE." },
      { role: "user", content: `${prompt}\n\nArticles:\n${JSON.stringify(articles, null, 2)}` },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(raw);
    return parsed.responses || parsed.results || parsed.articles || parsed;
  } catch (err) {
    console.error("⚠️ Failed to parse OpenAI response:", err);
    return [];
  }
}

/**
 * Step 4: Canonical department map
 */
const DEPT_MAP = {
  Marketing: "Echo", Echo: "Echo",
  Research: "Tenjiku", Tenjiku: "Tenjiku",
  Tech: "Manhattan", Manhattan: "Manhattan",
  Operations: "Helix", Helix: "Helix",
  Finance: "Vault", Vault: "Vault",
  Legal: "Legion", Legion: "Legion",
  HR: "Haven", Haven: "Haven",
  Strategy: "Kyoto", Kyoto: "Kyoto",
  Support: "Sentinel", Sentinel: "Sentinel",
  Global: "Global",
};

/**
 * Step 5: Main fetch service
 */
export async function fetchNewsFeed() {
  const raw = await fetchRawArticles();
  const prefiltered = prefilterArticles(raw);

  let enriched = [];
  try {
    enriched = await processWithAI(prefiltered);
  } catch (e) {
    console.error("⚠️ OpenAI classification failed:", e);
  }

  const final = prefiltered.map((r, i) => {
    const aiDept = enriched?.[i]?.department?.trim() || "Global";
    const canonicalDept =
      DEPT_MAP[aiDept] ||
      DEPT_MAP[aiDept.charAt(0).toUpperCase() + aiDept.slice(1)] ||
      "Global";

    return {
      ...r,
      department: canonicalDept,
      roles: enriched?.[i]?.roles?.length ? enriched[i].roles : ["Founder", "Superadmin"],
      importance: enriched?.[i]?.importance ?? 50,
      relevance: enriched?.[i]?.relevance ?? 50,
      summary: enriched?.[i]?.summary || r.summary || "No summary available",
    };
  });

  const kept = final.filter((a) => a.relevance >= 60);
  const dropped = final.filter((a) => a.relevance < 60);



  // dropped.forEach((d) =>
  //   console.log(`🪣 Dropped: "${d.title}" → relevance ${d.relevance}, dept ${d.department}`)
  // );

  return kept;
}

export async function fetchDeptNewsFeed(dept) {
  const raw = await fetchRawArticles();
  const prefiltered = prefilterArticles(raw);

  let enriched = [];
  try {
    const prompt = `
You are a TOTLE news relevance classifier.

Departments: Echo (Marketing), Tenjiku (Research), Manhattan (Tech), Helix (Operations),
Vault (Finance), Legion (Legal), Sentinel (Support), Haven (HR), Kyoto (Strategy).

Focus ONLY on articles relevant to **${dept}** department.
Return JSON array (same length, same order) with:
{
  "department": "${dept}",
  "roles": ["array of impacted roles"],
  "importance": number (0–100),
  "relevance": number (0–100),
  "summary": "1–2 sentence summary"
}
`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You classify authentic news for TOTLE." },
        { role: "user", content: `${prompt}\n\nArticles:\n${JSON.stringify(prefiltered, null, 2)}` },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    enriched = parsed.responses || parsed.results || parsed.articles || parsed;
  } catch (e) {
    console.error(`⚠️ OpenAI classification failed for dept ${dept}:`, e);
  }

  const final = prefiltered.map((r, i) => ({
    ...r,
    department: dept,
    roles: enriched?.[i]?.roles || ["Department Head", "Contributor"],
    importance: enriched?.[i]?.importance ?? 50,
    relevance: enriched?.[i]?.relevance ?? 50,
    summary: enriched?.[i]?.summary || r.summary || "No summary available",
  }));

  const kept = final.filter((a) => a.relevance >= 60);

  return kept;
}
