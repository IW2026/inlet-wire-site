/**
 * download-episode-covers.mjs
 * Downloads episode cover art from Spotify and saves as ep-XX-cover.jpg
 * in public/images/episodes/.
 *
 * Run from the site/ folder:
 *   node scripts/download-episode-covers.mjs
 */

import fs               from "fs";
import path             from "path";
import { fileURLToPath } from "url";

const SHOW_ID   = "1876137985"; // Apple Podcasts show ID

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const EPISODES_DIR = path.resolve(__dirname, "../src/content/episodes/");
const IMAGES_DIR   = path.resolve(__dirname, "../public/images/episodes/");

// ── Read episode files ───────────────────────────────────────────
const mdFiles = fs.readdirSync(EPISODES_DIR).filter(f => f.endsWith(".md"));

const episodes = mdFiles.map(file => {
  const content = fs.readFileSync(path.join(EPISODES_DIR, file), "utf8");
  const numMatch    = content.match(/^episode_number:\s*(\d+)/m);
  const artistMatch = content.match(/^artist:\s*["']?(.+?)["']?\s*$/m);
  if (!numMatch || !artistMatch) return null;
  return { num: parseInt(numMatch[1]), artist: artistMatch[1].trim(), file };
}).filter(Boolean).sort((a, b) => a.num - b.num);

// ── Fetch all episodes from iTunes ───────────────────────────────
console.log("Fetching episode list from iTunes…");
const res  = await fetch(`https://itunes.apple.com/lookup?id=${SHOW_ID}&media=podcast&entity=podcastEpisode&limit=200`);
const data = await res.json();
const itunesEps = data.results.filter(r => r.wrapperType === "podcastEpisode");
console.log(`✓ ${itunesEps.length} episodes found\n`);

function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

// ── Match + download ─────────────────────────────────────────────
for (const ep of episodes) {
  const padded   = String(ep.num).padStart(2, "0");
  const destPath = path.join(IMAGES_DIR, `ep-${padded}-cover.jpg`);

  if (fs.existsSync(destPath)) {
    console.log(`  — ep${padded} (${ep.artist}): already exists, skipping`);
    continue;
  }

  // Match iTunes episode by artist name in title
  const normArtist = normalize(ep.artist);
  const match = itunesEps.find(ie => normalize(ie.trackName).includes(normArtist));

  if (!match) {
    console.log(`  ✗ ep${padded} (${ep.artist}): no iTunes match found`);
    continue;
  }

  // artworkUrl600 is the largest available
  const imgUrl = (match.artworkUrl600 || match.artworkUrl100 || "").replace("100x100", "600x600");
  if (!imgUrl) {
    console.log(`  ✗ ep${padded} (${ep.artist}): no artwork URL`);
    continue;
  }

  const imgRes = await fetch(imgUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`  ✓ ep${padded} (${ep.artist}): saved (${Math.round(buffer.length / 1024)} KB)`);
}

console.log("\nDone.");
