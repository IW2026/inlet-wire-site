#!/usr/bin/env node
/**
 * Inlet Wire — per-episode promo kit
 *   npm run promo -- <slug>
 *
 * Builds drafts/<slug>/promo/ from the episode's approved frontmatter:
 *   promo.md        captions (Inlet Wire post, artist repost, short post, newsletter),
 *                   tracked links, and a short note for the artist
 *   embed.html      a small "listen to the interview" block artists can put on their site
 *   share-card.jpg  the 1200x630 card used for link previews
 *   square.jpg      the 1000x1000 episode cover, for Instagram
 *
 * No AI here. It only rearranges text you already approved, so nothing new gets
 * claimed about the artist. Everything is a starting point, edit before posting.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.log("Usage: npm run promo -- <episode-slug>"); process.exit(1); }

const epPath = join(ROOT, "src/content/episodes", `${slug}.md`);
if (!existsSync(epPath)) { console.error(`No episode file: src/content/episodes/${slug}.md`); process.exit(1); }

// same minimal frontmatter reader as prepare-episode.mjs
function readFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = {};
  if (!m) return data;
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) { if (!/^\s*\w+:/.test(item[1])) data[listKey].push(unq(item[1])); continue; }
    const kv = line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2] === "") { data[kv[1]] = []; listKey = kv[1]; } else { data[kv[1]] = unq(kv[2]); listKey = null; }
  }
  return data;
}
function unq(v) { v = v.trim(); return /^(["']).*\1$/.test(v) ? v.slice(1, -1).replace(/\\"/g, '"') : v; }

// JPEG width/height without dependencies
function jpegSize(path) {
  const b = readFileSync(path);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

const ep = readFrontmatter(readFileSync(epPath, "utf8"));
const num = String(ep.episode_number).padStart(2, "0");
const url = `https://inletwire.com/episodes/${slug}/`;
const track = (source, medium) => `${url}?utm_source=${source}&utm_medium=${medium}&utm_campaign=ep${num}-${slug}`;
const noDash = (s = "") => s.replace(/\s*—\s*/g, ", ").replace(/\*/g, "");
const from = ep.city ? ` from ${ep.city}` : "";
const firstName = (ep.guests?.[0] || ep.artist || "").split(" ")[0];
const blurb = noDash(ep.seo_description || ep.description || "");
// Lead with the artist only when the blurb doesn't already name them.
const mentions = (ep.artist && blurb.toLowerCase().includes(ep.artist.toLowerCase()));
const lead = mentions ? blurb : `${ep.artist}${from}. ${blurb}`;
const igHandle = ep.artist_instagram?.match(/instagram\.com\/([^/?#]+)/)?.[1];
const cityTag = ep.city ? `#${ep.city.toLowerCase().replace(/[^a-z]/g, "")}music` : "";

const flags = [];
const OUT = join(ROOT, "drafts", slug, "promo");
mkdirSync(OUT, { recursive: true });

// images
const og = join(ROOT, "public", (ep.og_image || `/images/og/ep-${num}.jpg`).replace(/^\//, ""));
const cover = join(ROOT, "public/images/episodes", `ep-${num}-cover.jpg`);
if (existsSync(og)) {
  copyFileSync(og, join(OUT, "share-card.jpg"));
  const s = og.endsWith(".jpg") ? jpegSize(og) : null;
  if (s && (s.width !== 1200 || s.height !== 630)) flags.push(`share card is ${s.width}x${s.height}, should be 1200x630`);
} else flags.push(`no share card at ${og.replace(ROOT + "/", "")}, run scripts/generate-og-cards.py`);
if (existsSync(cover)) {
  copyFileSync(cover, join(OUT, "square.jpg"));
  const s = jpegSize(cover);
  if (s && s.width !== s.height) flags.push(`cover is ${s.width}x${s.height}, not square`);
} else flags.push(`no episode cover at ${cover.replace(ROOT + "/", "")}`);
if (!ep.seo_description) flags.push("no seo_description yet, captions fall back to the card description (run npm run prep first)");
if (/^true$/.test(ep.draft)) flags.push("episode is still draft: true, the link will 404 until it's published");

const md = `# Promo kit: ${ep.artist} (ep. ${ep.episode_number})

Starting points only. Rewrite in your own words before posting.
${flags.length ? "\n**Check first:**\n" + flags.map((f) => `- ${f}`).join("\n") + "\n" : ""}
## Links

- Episode: ${url}
- For the artist to share: ${track("artist", "social")}
- Inlet Wire Instagram bio / stories: ${track("instagram", "social")}
- Newsletter: ${track("newsletter", "email")}

The tracked links show up in GA4 under Traffic acquisition, so you can see which posts actually brought people in. Link previews use share-card.jpg automatically.

## Inlet Wire post (Instagram, square.jpg)

New episode${mentions && ep.city ? `, out of ${ep.city}` : ""}.

${lead}

Full conversation at inletwire.com (link in bio), or wherever you listen.
${igHandle ? `\n@${igHandle}` : ""}

#bcmusic ${cityTag} #inletwire

## For ${firstName} to repost (send this along, they'll change it)

I sat down with Eric Chan for Inlet Wire. The conversation's up now: ${track("artist", "social")}

## Short post (Threads, Bluesky, X)

${lead} On Inlet Wire: ${url}

## Newsletter blurb

**${ep.artist}**${from}. ${mentions ? blurb : blurb} [Listen](${track("newsletter", "email")})

## Note to ${firstName}

Hey ${firstName}, the episode's up: ${url}

There's a share image on that link, so it should look right wherever you post it. If you keep a press or links page on your site, you're welcome to add it there too. There's a small embed in the kit (embed.html) if that's easier. No pressure either way.

Thanks again for doing this.
Eric
`;

const embed = `<!-- Inlet Wire interview: ${ep.artist}. Paste into your website. -->
<div style="max-width:560px;font-family:system-ui,sans-serif">
  <p style="margin:0 0 .5rem"><a href="${url}">${ep.artist} on Inlet Wire</a>, a conversation with Eric Chan.</p>
${ep.spotify_episode_id ? `  <iframe title="${ep.artist} on Inlet Wire" src="https://open.spotify.com/embed/episode/${ep.spotify_episode_id}" width="100%" height="152" frameborder="0" allow="encrypted-media" loading="lazy" style="border-radius:12px"></iframe>\n` : ""}</div>
`;

writeFileSync(join(OUT, "promo.md"), md);
writeFileSync(join(OUT, "embed.html"), embed);
console.log(`Promo kit: drafts/${slug}/promo/${flags.length ? `  (${flags.length} thing(s) to check, see promo.md)` : ""}`);
