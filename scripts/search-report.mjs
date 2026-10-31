#!/usr/bin/env node
/**
 * Inlet Wire — turn a Search Console export into a short to-do list.
 *   npm run search-report -- <folder with Queries.csv and Pages.csv>
 *
 * In Search Console: Performance > Search results > last 3 months > Export > Download CSV.
 * Unzip it and point this script at the folder. No API keys, no account linking.
 *
 * Writes docs/search-reports/<date>.md (commit it if you want a history) with:
 *   - totals and how much traffic is non-brand (real discovery, not people typing "inlet wire")
 *   - queries per episode (artist name, city/scene, topics)
 *   - queries close to page one (position 4-20), where a clearer title can help
 *   - pages that show up but don't get clicked (rewrite title/description)
 *   - published episodes with no impressions at all (check indexing)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2] && resolve(process.argv[2]);
if (!dir || !existsSync(dir)) { console.log("Usage: npm run search-report -- <unzipped Search Console export folder>"); process.exit(1); }

function csv(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => ({
    key: r[0],
    clicks: +r[1] || 0,
    impressions: +r[2] || 0,
    ctr: parseFloat(String(r[3]).replace("%", "")) || 0,
    position: parseFloat(r[4]) || 0,
  }));
}

const queries = csv(join(dir, "Queries.csv"));
const pages = csv(join(dir, "Pages.csv"));
if (!queries.length && !pages.length) { console.error("No Queries.csv / Pages.csv found in that folder."); process.exit(1); }

// episode catalog
const EP_DIR = join(ROOT, "src/content/episodes");
const field = (src, k) => src.match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, "m"))?.[1];
const episodes = readdirSync(EP_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const src = readFileSync(join(EP_DIR, f), "utf8");
    return {
      slug: f.replace(/\.md$/, ""),
      artist: field(src, "artist") || "",
      city: field(src, "city") || "",
      title: field(src, "seo_title") || field(src, "title") || "",
      guests: [...(src.match(/^guests:\n((?:\s+-.*\n)+)/m)?.[1].matchAll(/-\s*["']?(.*?)["']?\s*$/gm) ?? [])].map((m) => m[1]),
      draft: /^draft:\s*true/m.test(src),
    };
  })
  .filter((e) => !e.draft);

const n = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const BRAND = /inlet\s*wire|inletwire/;
const SCENE = /\b(bc|british columbia|vancouver|victoria|island|nanaimo|comox|pemberton|langford|campbell river|canadian|canada)\b/;

function matchEpisode(q) {
  const nq = n(q);
  return episodes.find((e) =>
    [e.artist, ...e.guests].some((name) => {
      const nn = n(name).replace(/^the /, "");
      return nn.length > 2 && (nq.includes(nn) || (nn.split(" ").length > 1 && nn.split(" ").every((w) => w.length > 2 && nq.includes(w))));
    })
  );
}

const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
const totalClicks = sum(queries, "clicks");
const totalImpr = sum(queries, "impressions");
const brand = queries.filter((r) => BRAND.test(n(r.key)));
const nonBrand = queries.filter((r) => !BRAND.test(n(r.key)));
const byEpisode = new Map();
const scene = [], other = [];
for (const r of nonBrand) {
  const ep = matchEpisode(r.key);
  if (ep) byEpisode.set(ep.slug, [...(byEpisode.get(ep.slug) || []), r]);
  else if (SCENE.test(n(r.key))) scene.push(r);
  else other.push(r);
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
const row = (r) => `| ${r.key} | ${r.clicks} | ${r.impressions} | ${r.ctr}% | ${r.position.toFixed(1)} |`;
const table = (rows, limit = 15) =>
  rows.length
    ? ["| Query / page | Clicks | Impr. | CTR | Pos. |", "|---|---|---|---|---|", ...rows.slice(0, limit).map(row)].join("\n")
    : "_None yet._";

const close = nonBrand.filter((r) => r.position >= 4 && r.position <= 20 && r.impressions >= 5).sort((a, b) => b.impressions - a.impressions);
const unclicked = pages
  .filter((p) => p.impressions >= 30 && p.ctr < 2)
  .sort((a, b) => b.impressions - a.impressions);
const seenSlugs = new Set(pages.map((p) => p.key.match(/\/episodes\/([^/]+)\/?$/)?.[1]).filter(Boolean));
const invisible = episodes.filter((e) => !seenSlugs.has(e.slug));

const today = new Date().toISOString().slice(0, 10);
const out = `# Search report ${today}

Source: ${dir.replace(ROOT + "/", "")}

## Totals

- Clicks ${totalClicks}, impressions ${totalImpr}, from ${queries.length} queries (Search Console only lists queries with enough volume).
- **Non-brand clicks: ${sum(nonBrand, "clicks")} (${pct(sum(nonBrand, "clicks"), totalClicks)})**, the number to watch. Brand ("inlet wire") clicks: ${sum(brand, "clicks")}.
- Searches for a featured artist: ${[...byEpisode.values()].flat().length} queries, ${sum([...byEpisode.values()].flat(), "clicks")} clicks.
- BC scene / place searches: ${scene.length} queries, ${sum(scene, "clicks")} clicks.

## Searches by episode

${[...byEpisode].sort((a, b) => sum(b[1], "impressions") - sum(a[1], "impressions")).map(([slug, rows]) => `### ${episodes.find((e) => e.slug === slug).artist} (/episodes/${slug}/)\n\n${table(rows.sort((a, b) => b.impressions - a.impressions), 8)}`).join("\n\n") || "_No artist-name searches yet._"}

## BC scene and place searches

${table(scene.sort((a, b) => b.impressions - a.impressions))}

These show what people look for beyond one artist. If one keeps growing (for example "victoria bc bands"), that's the signal for a written guide or a hub page with a real intro. Not before.

## Close to page one (position 4-20)

${table(close)}

For each: is the query's wording in that episode's \`seo_title\` or first paragraph? If the interview really covers it and the words are missing, add them naturally. Don't add a page.

## Seen but not clicked (30+ impressions, under 2% CTR)

${table(unclicked)}

Rewrite \`seo_title\` / \`seo_description\` for these so the result says plainly what the conversation is about.

## Published episodes with no impressions

${invisible.length ? invisible.map((e) => `- /episodes/${e.slug}/ (${e.artist})`).join("\n") + "\n\nRun URL Inspection on each in Search Console. If it says \"Crawled, currently not indexed\", the page usually needs more substance (an article, a transcript)." : "_Every published episode is getting impressions._"}

## Other queries

${table(other.sort((a, b) => b.impressions - a.impressions), 20)}

---
Next step for listener conversion: in GA4, open the Listener conversion exploration (see docs/SEO.md) and compare these pages' organic sessions with their listen_click counts.
`;

const outDir = join(ROOT, "docs/search-reports");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${today}.md`), out);
console.log(`Report: docs/search-reports/${today}.md`);
