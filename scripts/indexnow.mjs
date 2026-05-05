/**
 * IndexNow submission script — runs after a production build on Netlify.
 *
 * Submits all episode and key site URLs to IndexNow, which notifies Bing,
 * Yandex, and other participating search engines of new/updated content
 * instantly rather than waiting for their crawlers.
 *
 * Only runs on production deploys (CONTEXT === 'production').
 * Safe to run manually: `node scripts/indexnow.mjs`
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = "inletwire.com";
const KEY = "a7f3c9e2b5d1f4a8";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const INDEXNOW_API = "https://api.indexnow.org/indexnow";

// Only submit on Netlify production deploys (skip branch previews)
const context = process.env.CONTEXT;
if (context && context !== "production") {
  console.log(`[IndexNow] Skipping — context is "${context}", not "production".`);
  process.exit(0);
}

// Build the URL list from episode slugs in the content directory
const episodesDir = join(__dirname, "../src/content/episodes");
const files = await readdir(episodesDir);

const episodeSlugs = [];
for (const file of files) {
  if (!file.endsWith(".md") || file.includes("_article")) continue;
  const content = await readFile(join(episodesDir, file), "utf8");
  // Skip drafts
  if (/^draft:\s*true/m.test(content)) continue;
  const slug = file.replace(/\.md$/, "");
  episodeSlugs.push(slug);
}

const urls = [
  `https://${HOST}/`,
  `https://${HOST}/episodes/`,
  `https://${HOST}/about/`,
  `https://${HOST}/playlists/`,
  `https://${HOST}/contact/`,
  `https://${HOST}/media-kit/`,
  ...episodeSlugs.map((s) => `https://${HOST}/episodes/${s}/`),
  ...episodeSlugs.map((s) => `https://${HOST}/episodes/${s}/transcript/`),
];

console.log(`[IndexNow] Submitting ${urls.length} URLs to ${INDEXNOW_API}`);

const response = await fetch(INDEXNOW_API, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});

if (response.ok || response.status === 202) {
  console.log(`[IndexNow] Submitted successfully (HTTP ${response.status}).`);
} else {
  const body = await response.text().catch(() => "");
  console.error(`[IndexNow] Submission failed: HTTP ${response.status} — ${body}`);
  process.exit(1);
}
