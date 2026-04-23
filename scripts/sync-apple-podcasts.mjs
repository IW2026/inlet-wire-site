/**
 * sync-apple-podcasts.mjs
 * Fetches all Inlet Wire episodes from the iTunes API and writes
 * apple_podcast_url into each episode's frontmatter.
 *
 * Run from the site/ folder:
 *   node scripts/sync-apple-podcasts.mjs
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const SHOW_ID   = "1876137985";
const EPISODES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/content/episodes");

// ── 1. Fetch all episodes from iTunes ────────────────────────────
async function fetchAppleEpisodes() {
  const url = `https://itunes.apple.com/lookup?id=${SHOW_ID}&entity=podcastEpisode&limit=200`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.results
    .filter((r) => r.kind === "podcast-episode")
    .map((r) => ({
      title:    r.trackName,
      appleUrl: r.trackViewUrl,
    }));
}

// ── 2. Simple title similarity (normalise + word overlap) ────────
function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function similarity(a, b) {
  const wa = new Set(normalise(a).split(/\s+/));
  const wb = new Set(normalise(b).split(/\s+/));
  let matches = 0;
  for (const w of wa) if (wb.has(w)) matches++;
  return matches / Math.max(wa.size, wb.size);
}

function bestMatch(mdTitle, appleEpisodes) {
  let best = null, bestScore = 0;
  for (const ep of appleEpisodes) {
    const score = similarity(mdTitle, ep.title);
    if (score > bestScore) { bestScore = score; best = ep; }
  }
  return bestScore >= 0.3 ? best : null;
}

// ── 3. Read/write frontmatter ────────────────────────────────────
function getFrontmatterField(content, key) {
  const m = content.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return m ? m[1] : null;
}

function setFrontmatterField(content, key, value) {
  const escaped = value.replace(/"/g, '\\"');
  // If field exists, replace it
  if (new RegExp(`^${key}:`, "m").test(content)) {
    return content.replace(
      new RegExp(`^${key}:.*$`, "m"),
      `${key}: "${escaped}"`
    );
  }
  // Otherwise insert after spotify_episode_id or anchor_audio_url line
  return content.replace(
    /(spotify_episode_id:.*|anchor_audio_url:.*)/,
    `$1\napple_podcast_url: "${escaped}"`
  );
}

// ── 4. Main ──────────────────────────────────────────────────────
async function main() {
  console.log("Fetching episodes from iTunes API…");
  const appleEps = await fetchAppleEpisodes();
  console.log(`Found ${appleEps.length} episodes on Apple Podcasts.\n`);

  const files = (await readdir(EPISODES_DIR)).filter((f) => f.endsWith(".md"));
  let updated = 0;

  for (const file of files) {
    const filePath = join(EPISODES_DIR, file);
    const content  = await readFile(filePath, "utf8");

    // Skip if already has apple_podcast_url
    if (/^apple_podcast_url:/m.test(content)) {
      console.log(`  ✓ ${file} — already set, skipping`);
      continue;
    }

    const mdTitle = getFrontmatterField(content, "title") || file;
    const match   = bestMatch(mdTitle, appleEps);

    if (!match) {
      console.log(`  ✗ ${file} — no Apple Podcasts match found (add manually)`);
      continue;
    }

    const newContent = setFrontmatterField(content, "apple_podcast_url", match.appleUrl);
    await writeFile(filePath, newContent, "utf8");
    console.log(`  ✓ ${file} — matched "${match.title.slice(0, 50)}"`);
    updated++;
  }

  console.log(`\nDone. ${updated} file(s) updated.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
