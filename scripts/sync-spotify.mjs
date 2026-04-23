/**
 * sync-spotify.mjs
 * Fetches all Inlet Wire episodes from the Spotify API and writes
 * spotify_episode_id into the matching frontmatter of each .md file.
 *
 * Run from the site/ folder:
 *   node scripts/sync-spotify.mjs
 */

import fs from "fs";
import path from "path";

// ── Spotify app credentials ──────────────────────────────────────
const CLIENT_ID     = "dae92fe6ba1b4c5ab997ee7b35be663c";
const CLIENT_SECRET = "c7ea909a7508493ab59cae6b13cf060c";
const SHOW_ID       = "2BTlbhjjXBsV6MECUSUWwY"; // Inlet Wire show
const MARKET        = "CA";

// ── Paths ────────────────────────────────────────────────────────
const EPISODES_DIR = new URL("../src/content/episodes/", import.meta.url).pathname;

// ── Helpers ──────────────────────────────────────────────────────
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getToken() {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token fetch failed: " + JSON.stringify(data));
  return data.access_token;
}

async function fetchAllEpisodes(token) {
  const episodes = [];
  let url = `https://api.spotify.com/v1/shows/${SHOW_ID}/episodes?market=${MARKET}&limit=50`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    episodes.push(...data.items);
    url = data.next || null;
  }
  return episodes;
}

// ── Main ─────────────────────────────────────────────────────────
const token = await getToken();
console.log("✓ Token acquired");

const spotifyEpisodes = await fetchAllEpisodes(token);
console.log(`✓ ${spotifyEpisodes.length} episodes fetched from Spotify`);

const mdFiles = fs.readdirSync(EPISODES_DIR).filter((f) => f.endsWith(".md"));
let updated = 0;
let skipped = 0;
let unmatched = [];

for (const mdFile of mdFiles) {
  const filePath = path.join(EPISODES_DIR, mdFile);
  let content = fs.readFileSync(filePath, "utf8");

  // Extract artist name from frontmatter
  const artistMatch = content.match(/^artist:\s*["']?(.+?)["']?\s*$/m);
  if (!artistMatch) continue;
  const artist = artistMatch[1].trim();

  // Skip if already has a real Spotify ID (not placeholder)
  const existingId = content.match(/^spotify_episode_id:\s*["'](.+?)["']/m)?.[1];
  if (existingId && existingId !== "THE_22_CHAR_ID_FROM_THE_SPOTIFY_URL") {
    console.log(`  — ${mdFile}: already set (${existingId})`);
    skipped++;
    continue;
  }

  // Match by artist name
  const normArtist = normalize(artist);
  const match = spotifyEpisodes.find((ep) => {
    // Episode title on Spotify is typically "Artist: Episode Title" or just contains the artist name
    const normTitle = normalize(ep.name);
    return normTitle.includes(normArtist) || normArtist.includes(normalize(ep.name.split(":")[0] || ""));
  });

  if (!match) {
    unmatched.push({ file: mdFile, artist });
    continue;
  }

  // Write spotify_episode_id
  if (existingId === "THE_22_CHAR_ID_FROM_THE_SPOTIFY_URL") {
    content = content.replace(
      /spotify_episode_id:\s*["']THE_22_CHAR_ID_FROM_THE_SPOTIFY_URL["']/,
      `spotify_episode_id: "${match.id}"`
    );
  } else {
    // Insert after anchor_audio_url or after episode_number line
    content = content.replace(
      /^(episode_number:.+)$/m,
      `$1\nspotify_episode_id: "${match.id}"`
    );
  }

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✓ ${mdFile}: ${match.id}  («${match.name}»)`);
  updated++;
}

console.log(`\nDone. ${updated} updated, ${skipped} already set.`);

if (unmatched.length > 0) {
  console.log("\nCould not auto-match (add manually):");
  unmatched.forEach(({ file, artist }) => console.log(`  ${file}  (artist: ${artist})`));
}
