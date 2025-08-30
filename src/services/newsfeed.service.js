import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Fetch raw articles from authentic news sources
 * Example uses NewsAPI (https://newsapi.org/) — replace with another if you prefer.
 */
async function fetchRawArticles() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&category=technology&apiKey=${process.env.NEWS_API_KEY}`;
  const { data } = await axios.get(url);

  return data.articles.slice(0, 10).map((a, idx) => ({
    id: `news-${idx}-${Date.now()}`,
    title: a.title,
    summary: a.description || "",
    url: a.url,
    source: a.source.name,
    content: a.content || "",
  }));
}

/**
 * Use OpenAI to classify, score, and tag articles for TOTLE context
 */
async function processWithAI(articles) {
  const prompt = `
You are a classifier for TOTLE, a global edtech + venture ecosystem with 9 departments:
Research, Tech, Operations, Customer Support, Marketing, Strategy, Finance, Legal, HR.
Also roles: Founder, Superadmin, Department Head, Senior Project Manager, Project Manager, Contributor, Watcher, Intern.

For each article, return JSON with:
- department(s) most relevant
- roles most relevant
- importance (0-100)
- relevance (0-100)
- short summary (<= 2 sentences)

Articles:
${JSON.stringify(articles, null, 2)}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: "You classify authentic news for TOTLE." },
               { role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content || "{}").articles;
}

/**
 * Main service
 */
export async function fetchNewsFeed() {
  const raw = await fetchRawArticles();
  const enriched = await processWithAI(raw);

  // Merge enriched metadata back with raw info
  return raw.map((r, i) => ({
    ...r,
    department: enriched[i]?.department || "Global",
    roles: enriched[i]?.roles || ["Founder", "Superadmin"],
    importance: enriched[i]?.importance ?? 50,
    relevance: enriched[i]?.relevance ?? 50,
    summary: enriched[i]?.summary || r.summary,
    bookmarked: false,
  }));
}
