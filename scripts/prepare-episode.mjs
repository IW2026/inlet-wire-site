#!/usr/bin/env node
/**
 * Inlet Wire — episode SEO prep (AI-assisted, human-approved)
 *
 * Final episode + corrected transcript → AI draft → grounding check → review sheet.
 * This script NEVER edits src/content. It writes everything to drafts/<slug>/
 * and you copy what you approve into the episode file by hand.
 *
 * Usage
 *   npm run prep -- <slug>                      use transcript in src/content/transcripts/<slug>.md
 *   npm run prep -- <slug> --transcript file.srt   or an SRT / VTT / TXT / MD file
 *   npm run prep -- <slug> --article            also draft a 400-600 word article body
 *
 * Two ways to run the AI step
 *   1. Free (default): the script writes drafts/<slug>/prompt.md. Paste it into
 *      Claude, save the JSON reply as drafts/<slug>/response.json, run again.
 *   2. API: set ANTHROPIC_API_KEY (a few cents per episode). Optional IW_MODEL.
 *
 * Re-running with an existing response.json skips the AI step and just
 * re-checks it, so you can hand-edit the JSON and validate again.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EP_DIR = join(ROOT, "src/content/episodes");
const TR_DIR = join(ROOT, "src/content/transcripts");

// ── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--transcript" && args[args.indexOf(a) - 1] !== "--response");
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);

if (!slug) {
  console.log("Usage: npm run prep -- <episode-slug> [--transcript path] [--article] [--fresh]");
  process.exit(1);
}

const OUT = join(ROOT, "drafts", slug);
mkdirSync(OUT, { recursive: true });

// ── tiny frontmatter reader (scalars + simple lists, enough for our files) ──
export function readFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      if (!/^\s*\w+:/.test(item[1])) data[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "") { data[k] = []; listKey = k; }
    else { data[k] = unquote(v); listKey = null; }
  }
  return { data, body: m[2] };
}
function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

// ── transcript loading ─────────────────────────────────────────────────────
function cleanCaptions(text) {
  return text
    .replace(/^﻿/, "")
    .replace(/^WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter((l) => !/^\d+$/.test(l.trim()))
    .filter((l) => !/\d{1,2}:\d{2}(:\d{2})?[.,]\d{1,3}\s*-->/.test(l))
    .join("\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadTranscript(epBody) {
  const given = opt("transcript");
  if (given) {
    const p = resolve(given);
    if (!existsSync(p)) throw new Error(`Transcript not found: ${p}`);
    const t = readFileSync(p, "utf8");
    return { text: /\.(srt|vtt)$/i.test(p) ? cleanCaptions(t) : readFrontmatter(t).body, source: p };
  }
  const tp = join(TR_DIR, `${slug}.md`);
  if (existsSync(tp)) return { text: readFrontmatter(readFileSync(tp, "utf8")).body, source: tp };
  const inline = epBody.match(/<details[^>]*id="transcript"[\s\S]*?<\/details>/);
  if (inline) return { text: inline[0].replace(/<[^>]+>/g, ""), source: "inline <details> in episode file" };
  throw new Error(`No transcript for "${slug}". Add src/content/transcripts/${slug}.md or pass --transcript <file>.`);
}

// ── catalog of other episodes, for internal-link suggestions ───────────────
function loadCatalog() {
  return readdirSync(EP_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), ...readFrontmatter(readFileSync(join(EP_DIR, f), "utf8")).data }))
    .filter((e) => e.draft !== "true");
}

// ── prompt ─────────────────────────────────────────────────────────────────
function buildPrompt({ ep, transcript, catalog, wantArticle }) {
  const others = catalog
    .filter((e) => e.slug !== slug)
    .map((e) => `- ${e.slug} | ${e.artist} | ${e.city ?? "?"} | tags: ${(e.tags || []).join(", ")} | ${e.description ?? ""}`)
    .join("\n");

  return `You are preparing search metadata for an Inlet Wire episode page. Inlet Wire is a human-led editorial podcast about British Columbia artists, hosted by Eric Chan. The goal is to help people who are already searching for this artist, their scene, or the subjects they talk about find this interview. It is not to produce more content.

## Hard rules
1. Use ONLY what is in the transcript and the episode details below. Do not add biography, release titles, labels, dates, venues, collaborators, awards or numbers that are not stated there. Not from memory, not from the web.
2. Never invent or tidy up quotes. If you quote, copy the transcript words exactly.
3. Every claim you rely on goes in "facts", with a verbatim excerpt from the transcript (5 to 30 words) as evidence. If you cannot point to the words, leave the claim out.
4. If something is unclear (a name spelling, a place, who said what), put it in "uncertain" instead of guessing.
5. Voice: plain, local, specific. No hype, no promo, no "dive into", "journey", "tapestry", "captivating", "must-listen", "tune in". No em dashes. Do not evaluate the music or tell people how to hear it.
6. Titles and descriptions should read like an editor wrote them for a person, and still contain the words someone would actually search (artist name, city, the main subject). No keyword lists.
7. Only suggest related episodes from the list provided, and only when there is a real connection (same scene, same subject, same kind of work). Fewer is better than weak.
8. A standalone article is the exception. Recommend one only if the interview has substantial, useful material on a subject people search for independently of this artist (for example how a Vancouver studio budgets a record, or applying for a music grant in BC). Otherwise recommended=false.

## Episode details (from the site)
slug: ${slug}
artist: ${ep.artist ?? ""}
title: ${ep.title ?? ""}
episode_number: ${ep.episode_number ?? ""}
publish_date: ${ep.publish_date ?? ""}
current description: ${ep.description ?? ""}
current tags: ${(ep.tags || []).join(", ")}
city: ${ep.city ?? ""}   region: ${ep.region ?? ""}
guests: ${(ep.guests || []).join(", ")}

## Other published episodes (slug | artist | city | tags | description)
${others}

## Reply format
Reply with ONE JSON object and nothing else:
{
  "seo_title": "max 60 characters, artist name first, no '| Inlet Wire'",
  "seo_description": "140-160 characters, natural sentence, what the conversation is about",
  "description": "about 20-30 words for episode cards, only if the current one is weak, else repeat the current one",
  "summary": "2-4 sentence editorial summary grounded in the transcript",
  "topics": ["2-6 short phrases for subjects actually discussed"],
  "search_phrases": ["5-10 realistic searches this page could answer, for Eric's planning only"],
  "tags": ["lowercase-hyphenated, reuse existing tag style"],
  "city": "only if stated in the transcript or details, else null",
  "region": "e.g. 'Vancouver Island, BC', only if clear, else null",
  "guests": ["full names exactly as said in the transcript"],
  "artist_type": "MusicGroup | Person | Organization",
  "facts": [{ "claim": "...", "evidence": "verbatim transcript words" }],
  "related": [{ "slug": "...", "reason": "..." }],
  "in_body_links": [{ "anchor_text": "words already likely in the article", "slug": "...", "reason": "..." }],
  "standalone_article": { "recommended": false, "reason": "...", "working_title": "", "angle": "", "outline": [], "evidence": [] },
  "uncertain": ["things Eric should check"]${wantArticle ? `,
  "article_markdown": "400-600 word article body in Markdown, 3-5 specific H2 subheads, concrete opening image, story-forward not a summary, ends with one line pointing to the episode. Only facts from the transcript. Any direct quote must be verbatim."` : ""}
}

## Transcript
${transcript}
`;
}

// ── AI call (optional) ─────────────────────────────────────────────────────
async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.IW_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.content.map((c) => c.text || "").join("");
}

function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return JSON.parse(t.slice(start, end + 1));
}

// ── grounding + quality checks ─────────────────────────────────────────────
export const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "exact" | "close" (≥70% of 4-word runs found) | "missing" */
export function evidenceStatus(evidence, normTranscript) {
  const e = norm(evidence);
  if (!e) return "missing";
  if (normTranscript.includes(e)) return "exact";
  const w = e.split(" ");
  if (w.length < 4) return "missing";
  let hit = 0, total = 0;
  for (let i = 0; i + 4 <= w.length; i++) {
    total++;
    if (normTranscript.includes(w.slice(i, i + 4).join(" "))) hit++;
  }
  return hit / total >= 0.7 ? "close" : "missing";
}

const BANNED = [
  "dive into", "deep dive", "journey", "tapestry", "captivating", "must-listen", "must listen",
  "tune in", "you won't want to miss", "don't miss", "in this episode we explore", "join us",
  "fascinating", "game-changer", "game changer", "unforgettable", "honestly", "delve",
];

function checkDraft(d, { ep, transcript, catalog }) {
  const flags = []; // [level, message]
  const T = norm(transcript);
  const known = new Set(catalog.map((e) => e.slug));
  const textFields = [d.seo_title, d.seo_description, d.description, d.summary, d.article_markdown].filter(Boolean);

  // lengths
  if (!d.seo_title) flags.push(["error", "seo_title is missing"]);
  else {
    if (d.seo_title.length > 60) flags.push(["warn", `seo_title is ${d.seo_title.length} chars (aim for 60 or less, Google cuts it off)`]);
    if (/inlet wire/i.test(d.seo_title)) flags.push(["error", "seo_title includes 'Inlet Wire' (the layout adds '| Inlet Wire' already)"]);
    if (ep.artist && !norm(d.seo_title).includes(norm(ep.artist).split(" ")[0])) flags.push(["warn", "seo_title does not include the artist name"]);
  }
  if (!d.seo_description) flags.push(["error", "seo_description is missing"]);
  else if (d.seo_description.length < 120 || d.seo_description.length > 165)
    flags.push(["warn", `seo_description is ${d.seo_description.length} chars (aim for 140-160)`]);

  // style
  for (const f of textFields) {
    if (/—/.test(f)) flags.push(["warn", `em dash in: "${f.slice(0, 70)}..."`]);
    for (const b of BANNED) if (norm(f).includes(norm(b))) flags.push(["warn", `phrase to avoid "${b}" in: "${f.slice(0, 70)}..."`]);
  }

  // facts must be backed by the transcript
  const facts = (d.facts || []).map((f) => ({ ...f, status: evidenceStatus(f.evidence, T) }));
  for (const f of facts) if (f.status === "missing") flags.push(["error", `fact not found in transcript: "${f.claim}"`]);
  if (!facts.length) flags.push(["warn", "no facts with evidence were returned"]);

  // any direct quote (4+ words) must be verbatim
  for (const f of textFields) {
    for (const q of f.matchAll(/["“]([^"”]{12,}?)["”]/g)) {
      if (q[1].split(/\s+/).length < 4) continue;
      const st = evidenceStatus(q[1], T);
      if (st !== "exact") flags.push([st === "close" ? "warn" : "error", `quote not verbatim in transcript (${st}): "${q[1].slice(0, 80)}"`]);
    }
  }

  // guests, city
  for (const g of d.guests || []) {
    const parts = norm(g).split(" ").filter((p) => p.length > 1);
    const found = parts.filter((p) => T.includes(p)).length;
    const inSite = (ep.guests || []).some((x) => norm(x) === norm(g));
    if (!inSite && found < parts.length) flags.push(["error", `guest "${g}" is not fully named in the transcript, confirm spelling`]);
  }
  if (d.city && !T.includes(norm(d.city)) && norm(d.city) !== norm(ep.city))
    flags.push(["warn", `city "${d.city}" is not mentioned in the transcript, confirm`]);

  // capitalised names in prose that never appear in the transcript
  const allowed = new Set(["inlet", "wire", "eric", "chan", "bc", "british", "columbia", "canada", "canadian", "i", "the", "a", "and", "on", "in", "of", "with", "for", "to"]);
  for (const w of norm(ep.artist).split(" ")) allowed.add(w);
  const prose = [d.summary, d.article_markdown, d.seo_description].filter(Boolean).join(" ");
  const names = new Set();
  for (const m of prose.matchAll(/(?<![.!?]\s|^|\n|#\s)\b([A-Z][a-zA-Z'’]+(?:\s+[A-Z][a-zA-Z'’]+)*)/g)) {
    const words = norm(m[1]).split(" ").filter((x) => !allowed.has(x));
    if (words.length && !words.every((x) => T.includes(x))) names.add(m[1]);
  }
  for (const n of names) flags.push(["warn", `name or proper noun not in transcript: "${n}", check it is real and correct`]);

  // links
  for (const r of [...(d.related || []), ...(d.in_body_links || [])]) {
    if (!known.has(r.slug)) flags.push(["error", `suggested link to unknown episode "${r.slug}"`]);
    if (r.slug === slug) flags.push(["error", "suggested a link to this same episode"]);
  }

  return { flags, facts };
}

// ── review sheet ───────────────────────────────────────────────────────────
const yamlStr = (s) => JSON.stringify(String(s));
function renderReview(d, { ep, flags, facts, source }) {
  const errors = flags.filter((f) => f[0] === "error");
  const warns = flags.filter((f) => f[0] === "warn");
  const lines = [];
  lines.push(`# Review: ${ep.artist ?? slug} (ep. ${ep.episode_number ?? "?"})`, "");
  lines.push(`Transcript used: ${source.replace(ROOT + "/", "")}`, "");
  lines.push(
    errors.length
      ? `**${errors.length} problem(s) to fix before using this.** ${warns.length} thing(s) to look at.`
      : `No grounding problems found. ${warns.length} thing(s) to look at.`,
    ""
  );
  if (flags.length) {
    lines.push("## Checks", "");
    for (const [lvl, msg] of [...errors, ...warns]) lines.push(`- ${lvl === "error" ? "FIX" : "check"}: ${msg}`);
    lines.push("");
  }

  lines.push("## Paste into the episode frontmatter (after you approve it)", "");
  lines.push("Only copy the lines you agree with. Leave `draft: true` until the page is ready.", "");
  lines.push("```yaml");
  lines.push(`seo_title: ${yamlStr(d.seo_title ?? "")}`);
  lines.push(`seo_description: ${yamlStr(d.seo_description ?? "")}`);
  if (d.description && d.description !== ep.description) lines.push(`description: ${yamlStr(d.description)}`);
  if (d.topics?.length) { lines.push("topics:"); for (const t of d.topics) lines.push(`  - ${yamlStr(t)}`); }
  if (d.related?.length) { lines.push("related:"); for (const r of d.related) lines.push(`  - ${r.slug}`); }
  if (d.artist_type && d.artist_type !== "MusicGroup") lines.push(`artist_type: ${d.artist_type}`);
  if (!ep.city && d.city) lines.push(`city: ${yamlStr(d.city)}`);
  if (!ep.region && d.region) lines.push(`region: ${yamlStr(d.region)}`);
  if (!(ep.guests || []).length && d.guests?.length) { lines.push("guests:"); for (const g of d.guests) lines.push(`  - ${yamlStr(g)}`); }
  const newTags = (d.tags || []).filter((t) => !(ep.tags || []).includes(t));
  if (newTags.length) lines.push(`# suggested extra tags: ${newTags.join(", ")}`);
  lines.push("```", "");

  lines.push("## Summary", "", d.summary ?? "", "");
  if (d.search_phrases?.length) {
    lines.push("## Searches this page could answer (planning only, don't paste these anywhere)", "");
    for (const s of d.search_phrases) lines.push(`- ${s}`);
    lines.push("");
  }
  lines.push("## Facts and where they come from", "");
  for (const f of facts) lines.push(`- [${f.status}] ${f.claim}\n  > ${f.evidence}`);
  lines.push("");
  if (d.related?.length || d.in_body_links?.length) {
    lines.push("## Internal links", "");
    for (const r of d.related || []) lines.push(`- More like this: /episodes/${r.slug}/ (${r.reason})`);
    for (const r of d.in_body_links || []) lines.push(`- In the article, link "${r.anchor_text}" to /episodes/${r.slug}/ (${r.reason})`);
    lines.push("");
  }
  const sa = d.standalone_article || {};
  lines.push("## Standalone article?", "");
  lines.push(sa.recommended ? `**Worth considering:** ${sa.working_title}\n\n${sa.reason}\n\nAngle: ${sa.angle}` : `No. ${sa.reason ?? ""}`);
  if (sa.recommended && sa.outline?.length) { lines.push(""); for (const o of sa.outline) lines.push(`- ${o}`); }
  lines.push("");
  if (d.uncertain?.length) {
    lines.push("## Check before publishing", "");
    for (const u of d.uncertain) lines.push(`- ${u}`);
    lines.push("");
  }
  if (d.article_markdown) lines.push("## Article draft", "", "Saved separately as `article.md` in this folder.", "");
  lines.push("---", "Nothing here has been published. Copy what you approve into", `src/content/episodes/${slug}.md, run \`npm run build\` and \`npm run seo:check\`, then commit.`);
  return lines.join("\n");
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const epPath = join(EP_DIR, `${slug}.md`);
  if (!existsSync(epPath)) throw new Error(`No episode file at src/content/episodes/${slug}.md. Create it first (draft: true is fine).`);
  const { data: ep, body } = readFrontmatter(readFileSync(epPath, "utf8"));
  const { text: transcript, source } = loadTranscript(body);
  const catalog = loadCatalog();
  const wantArticle = flag("article");

  const prompt = buildPrompt({ ep, transcript, catalog, wantArticle });
  writeFileSync(join(OUT, "prompt.md"), prompt);

  const respPath = opt("response") ? resolve(opt("response")) : join(OUT, "response.json");
  let raw;
  if (existsSync(respPath) && !flag("fresh")) {
    raw = readFileSync(respPath, "utf8");
    console.log(`Using saved AI reply: ${respPath.replace(ROOT + "/", "")}`);
  } else if (process.env.ANTHROPIC_API_KEY) {
    console.log("Asking Claude (API)...");
    raw = await callClaude(prompt);
    writeFileSync(join(OUT, "response.json"), raw);
  } else {
    console.log(`
Prompt ready: drafts/${slug}/prompt.md

  1. Open a new Claude chat and paste the whole file.
  2. Save Claude's JSON reply as drafts/${slug}/response.json
  3. Run this again:  npm run prep -- ${slug}${wantArticle ? " --article" : ""}

(Or set ANTHROPIC_API_KEY to do step 1-2 automatically.)`);
    return;
  }

  const draft = parseJson(raw);
  const { flags, facts } = checkDraft(draft, { ep, transcript, catalog });
  writeFileSync(join(OUT, "review.md"), renderReview(draft, { ep, flags, facts, source }));
  if (draft.article_markdown) writeFileSync(join(OUT, "article.md"), draft.article_markdown.trim() + "\n");

  const errs = flags.filter((f) => f[0] === "error").length;
  console.log(`Review sheet: drafts/${slug}/review.md  (${errs} to fix, ${flags.length - errs} to check)`);
  process.exitCode = errs ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
