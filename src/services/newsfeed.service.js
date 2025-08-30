import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Step 1: Fetch raw articles from NewsAPI
 * Using multiple TOTLE-relevant domains: education, AI, finance, HR, legal, etc.
 */
async function fetchRawArticles() {
  const query = encodeURIComponent(
    "education OR edtech OR 'online learning' OR 'higher education' OR university OR 'student mobility' OR 'skills development' OR 'startup funding' OR 'AI in education' OR 'AI policy' OR 'finance in edtech' OR 'HR policy' OR 'legal compliance' OR 'marketing strategy'"
  );

  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;

  const { data } = await axios.get(url);

  // Extract and normalize
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
 * Step 2: Filter out totally irrelevant articles (quick keyword filter before AI call)
 */
function prefilterArticles(articles) {
  const keywords = [
    "education",
    "edtech",
    "learning",
    "university",
    "student",
    "teacher",
    "ai",
    "artificial intelligence",
    "finance",
    "funding",
    "startup",
    "policy",
    "regulation",
    "hr",
    "human resources",
    "legal",
    "compliance",
    "marketing",
    "strategy",
    "operations",
  ];

  return articles.filter((a) => {
    const text = `${a.title} ${a.summary} ${a.content}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });
}

/**
 * Step 3: Use OpenAI to classify & score relevance
 */
async function processWithAI(articles) {
  if (!articles.length) return [];

  const prompt = `
You are a news relevance engine for TOTLE, a global edtech + venture ecosystem.

TOTLE has:
- Roles: Founder, Superadmin, Department Head, Senior Project Manager, Project Manager, Contributor, Watcher, Intern.
- Departments: Research, Tech, Operations, Customer Support, Marketing, Strategy, Finance, Legal, Human Resources.

For each article, classify and output JSON with:
- department: one of the 9 departments most relevant, or "Global" if it's org-wide
- roles: which roles are most impacted
- importance: number 0–100 (how strategically important for TOTLE)
- relevance: number 0–100 (how directly connected to TOTLE domains)
- summary: short 1–2 sentence summary
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You classify authentic news for TOTLE." },
      { role: "user", content: `${prompt}\nArticles:\n${JSON.stringify(articles, null, 2)}` },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    return parsed.articles || [];
  } catch (err) {
    console.error("⚠️ Failed to parse OpenAI response:", err);
    return [];
  }
}

/**
 * Step 4: Main fetch service
 */
export async function fetchNewsFeed() {
  // Fetch and prefilter
  const raw = await fetchRawArticles();
  const prefiltered = prefilterArticles(raw);

  // Classify with AI
  let enriched = [];
  try {
    enriched = await processWithAI(prefiltered);
  } catch (e) {
    console.error("⚠️ OpenAI classification failed:", e);
  }

  // Merge and enforce relevance threshold
  return prefiltered
    .map((r, i) => ({
      ...r,
      department: enriched?.[i]?.department || "Global",
      roles: enriched?.[i]?.roles || ["Founder", "Superadmin"],
      importance: enriched?.[i]?.importance ?? 50,
      relevance: enriched?.[i]?.relevance ?? 50,
      summary: enriched?.[i]?.summary || r.summary || "No summary available",
    }))
    .filter((a) => a.relevance >= 60); // Only TOTLE-relevant
}
