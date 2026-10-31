#!/usr/bin/env node
/**
 * Inlet Wire — post-build SEO check.  Run after `npm run build`:
 *   npm run seo:check
 *
 * Reads dist/ and the sitemap, and reports anything that would hurt indexing:
 * missing or duplicate titles/descriptions, wrong canonicals, broken JSON-LD,
 * noindex pages in the sitemap, sitemap URLs with no page, broken internal
 * links, missing image alt text. Exits 1 if there are errors (not warnings).
 * Not wired into the Netlify build on purpose, so a warning never blocks a deploy.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SITE = "https://inletwire.com";
const SKIP = [/^\/portfolio\//, /^\/eric_portfolio\//];

if (!existsSync(DIST)) {
  console.error("No dist/ folder. Run `npm run build` first.");
  process.exit(1);
}

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith(".html"));
const errors = [];
const warns = [];
const titles = new Map();
const descs = new Map();
const noindexUrls = new Set();
const schemaTypes = new Map();

const urlFor = (file) => {
  let p = "/" + relative(DIST, file).replace(/\\/g, "/");
  p = p.replace(/index\.html$/, "");
  return p;
};
const attr = (tag, name) => tag.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((x) => x != null);
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function targetExists(href) {
  const path = decodeURIComponent(href.split(/[?#]/)[0]);
  if (path === "" || path === "/") return true;
  const p = join(DIST, path);
  return existsSync(p) && statSync(p).isFile() ? true : existsSync(join(p, "index.html")) || existsSync(p + ".html");
}

for (const file of pages) {
  const url = urlFor(file);
  if (SKIP.some((r) => r.test(url))) continue;
  const html = readFileSync(file, "utf8");
  const where = url;

  const robots = html.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0];
  const noindex = robots && /noindex/i.test(attr(robots, "content") || "");
  if (noindex || url === "/404.html") { noindexUrls.add(SITE + url); continue; }

  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim());
  if (!title) errors.push(`${where}: no <title>`);
  else {
    if (title.length > 70) warns.push(`${where}: title is ${title.length} chars, may be cut off: "${title}"`);
    titles.set(title, [...(titles.get(title) || []), url]);
  }

  const descTag = html.match(/<meta[^>]+name="description"[^>]*>/i)?.[0];
  const desc = decode(descTag && attr(descTag, "content"));
  if (!desc) errors.push(`${where}: no meta description`);
  else {
    if (desc.length < 70) warns.push(`${where}: meta description is short (${desc.length} chars)`);
    if (desc.length > 170) warns.push(`${where}: meta description is ${desc.length} chars, Google will cut it`);
    descs.set(desc, [...(descs.get(desc) || []), url]);
  }

  const canonTag = html.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0];
  const canon = canonTag && attr(canonTag, "href");
  if (!canon) errors.push(`${where}: no canonical`);
  else if (canon !== SITE + url) errors.push(`${where}: canonical points to ${canon}`);

  if (!/property="og:image"/.test(html)) warns.push(`${where}: no og:image`);
  const ogImg = html.match(/<meta[^>]+property="og:image"[^>]*>/i)?.[0];
  const ogSrc = ogImg && attr(ogImg, "content");
  if (ogSrc?.startsWith(SITE) && !targetExists(ogSrc.slice(SITE.length))) errors.push(`${where}: og:image file missing (${ogSrc})`);

  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) warns.push(`${where}: ${h1s} <h1> tags (expected 1)`);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of [].concat(data)) {
        const t = node["@type"];
        schemaTypes.set(t, (schemaTypes.get(t) || 0) + 1);
        if (t === "PodcastEpisode") {
          for (const k of ["name", "url", "datePublished", "partOfSeries", "description"])
            if (!node[k]) errors.push(`${where}: PodcastEpisode missing ${k}`);
          if (!node.associatedMedia) warns.push(`${where}: PodcastEpisode has no audio (associatedMedia)`);
          if (!node.duration) warns.push(`${where}: PodcastEpisode has no duration`);
        }
      }
    } catch (e) {
      errors.push(`${where}: JSON-LD does not parse (${e.message})`);
    }
  }

  for (const m of html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/gi)) {
    const href = decode(m[1]);
    if (href.startsWith("//")) continue;
    if (!targetExists(href)) errors.push(`${where}: broken internal link ${href}`);
  }

  for (const m of html.matchAll(/<img\s[^>]*>/gi)) {
    if (!/\salt=/.test(m[0]) && !/aria-hidden/.test(m[0])) warns.push(`${where}: <img> without alt (${attr(m[0], "src")})`);
  }

  const words = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").match(/<main[\s\S]*<\/main>/)?.[0]
    .replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length ?? 0;
  if (/^\/episodes\/[^/]+\/$/.test(url) && words < 250) warns.push(`${where}: thin page (${words} words in <main>)`);
}

for (const [t, urls] of titles) if (urls.length > 1) errors.push(`duplicate title "${t}" on ${urls.join(", ")}`);
for (const [d, urls] of descs) if (urls.length > 1) warns.push(`duplicate meta description on ${urls.join(", ")}`);

// sitemap
const smFiles = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
let smCount = 0;
if (!smFiles.length) errors.push("no sitemap-N.xml in dist");
for (const f of smFiles) {
  const xml = readFileSync(f, "utf8");
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    smCount++;
    const loc = m[1];
    if (noindexUrls.has(loc)) errors.push(`sitemap lists a noindex page: ${loc}`);
    if (!loc.startsWith(SITE) || !targetExists(loc.slice(SITE.length))) errors.push(`sitemap URL has no page: ${loc}`);
    if (m[2] && new Date(m[2]) > new Date(Date.now() + 864e5)) warns.push(`sitemap lastmod in the future: ${loc}`);
  }
}

// robots
const robots = existsSync(join(DIST, "robots.txt")) ? readFileSync(join(DIST, "robots.txt"), "utf8") : "";
if (!/Sitemap:\s*https:\/\/inletwire\.com\/sitemap-index\.xml/.test(robots)) errors.push("robots.txt is missing the Sitemap line");

console.log(`Checked ${pages.length} pages, ${smCount} sitemap URLs.`);
console.log(`Structured data: ${[...schemaTypes].map(([t, n]) => `${t} x${n}`).join(", ")}`);
if (warns.length) console.log(`\n${warns.length} warning(s):\n` + warns.map((w) => "  - " + w).join("\n"));
if (errors.length) console.log(`\n${errors.length} error(s):\n` + errors.map((e) => "  - " + e).join("\n"));
else console.log("\nNo errors.");
process.exit(errors.length ? 1 : 0);
