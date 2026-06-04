# Inlet Wire — Website

Static site for Inlet Wire, built with Astro. Hosted on Cloudflare Pages, rebuilt and redeployed automatically on every push to `main`.

## Local setup (one time)

Install Node.js 20 or higher from nodejs.org if you do not have it already. Then from this folder:

```
npm install
```

## Run the site locally

```
npm run dev
```

Open http://localhost:4321 in your browser. Edits live-reload.

## Build the production site (optional, for local check)

```
npm run build
npm run preview
```

## Add a new episode

1. Create a new markdown file in `src/content/episodes/`, named after a URL-friendly slug (for example `molly-annelle.md`). The filename becomes the URL: `/episodes/molly-annelle/`.
2. Paste this frontmatter at the top and fill it in:

```yaml
---
# ── Required ──────────────────────────────────────────────────────────────────
title: "Episode headline — editorial and human"
artist: "Artist or band name"
episode_number: 19
publish_date: 2026-06-09
description: "One or two sentences used on episode cards and as the default meta description."
tags:
  - tag1
  - tag2

# ── Audio / platform ──────────────────────────────────────────────────────────
spotify_episode_id: "paste_spotify_episode_id"
anchor_audio_url: "https://anchor.fm/..."
apple_podcast_url: "https://podcasts.apple.com/..."
youtube_episode_url: "https://www.youtube.com/watch?v=..."
iheart_episode_url: "https://www.iheart.com/..."
featured_playlist_id: "optional_spotify_playlist_id"

# ── Flags ─────────────────────────────────────────────────────────────────────
has_transcript: false
draft: false
hide_photos: false

# ── Artist links (all optional) ───────────────────────────────────────────────
artist_website: "https://..."
artist_instagram: "https://www.instagram.com/..."
artist_youtube: "https://www.youtube.com/@..."
artist_facebook: "https://www.facebook.com/..."
artist_bandcamp: "https://....bandcamp.com/"

# ── SEO overrides (all optional — affect only <title> and meta, not page text) ─
# seo_title must NOT include "| Inlet Wire" — BaseLayout appends it automatically.
# seo_description should be natural and social-friendly, ideally 140–160 characters.
seo_title: "Artist on Topic, Topic, and Topic"
seo_description: "One or two sentences. Natural, not keyword-stuffed. Around 140–160 characters."

# og_image is only needed to override the default /images/og/ep-NN.jpg.
# og_image: "/images/og/ep-NN-alt.jpg"

# ── Local SEO / entity data (all optional) ────────────────────────────────────
# city and region power the All Episodes location display and local SEO.
# guests, studio, and producer must be clearly confirmed in the episode content.
# Do not guess. Leave blank if uncertain.
city: "Vancouver"
region: "BC"
guests:
  - "First Last"
studio: "Studio Name"
producer: "Producer Name"
---
```

**Field notes**

- `title` stays editorial and human — this is what appears on the page as the visible lede.
- `seo_title` is the behind-the-scenes `<title>` tag only. Never change the visible page heading here.
- `city` + `region` appear as a subtle location line on episode cards across the site (e.g. `Nanaimo, Vancouver Island, BC`).
- `guests` should be exact names as they appear in the episode. First name only is acceptable if that is all that is confirmed.
- Only fill `studio` and `producer` when explicitly stated in the episode — do not infer from tags.

**Example (The Shindigs)**

```yaml
title: "The Shindigs: From Childhood Buddies to a Band"
artist: "The Shindigs"
seo_title: "The Shindigs on Nanaimo Roots, Friendship, and Growing Into a Band"
seo_description: "The Shindigs talk about Nanaimo roots, childhood friendship, and how the band grew into something more serious on Inlet Wire."
city: "Nanaimo"
region: "Vancouver Island, BC"
guests:
  - "Shea Peoples"
  - "Alex Peabody"
```

**New episode checklist**

- [ ] Confirm artist name spelling
- [ ] Confirm guest names from episode content — do not guess
- [ ] Confirm pronunciation guide separately if needed
- [ ] Confirm city and region
- [ ] Write `seo_title` without `| Inlet Wire`
- [ ] Write `seo_description` around 140–160 characters
- [ ] Confirm OG image path (leave blank to use default `ep-NN.jpg`)
- [ ] Set `draft: true` while working, flip to `false` before publishing
- [ ] Run `npm run build` locally before pushing

3. Write the article body below the frontmatter using normal Markdown. Aim for 400 to 600 words, with `##` and `###` subheads for SEO.
4. Open GitHub Desktop. Review the change, write a short commit summary ("Add Molly Annelle episode"), click Commit to main, then Push origin.
5. Site rebuilds on Cloudflare and goes live in about 60 seconds.

## Where to find Spotify IDs

Open the episode on Spotify in a browser. The URL looks like:

```
https://open.spotify.com/episode/4aB2cD3eF7gH1iJ5kL9mN
```

The last segment (`4aB2cD3eF7gH1iJ5kL9mN`) is the `spotify_episode_id`. Playlist IDs work the same way from a playlist URL.

## File map

- `src/content/episodes/` — every episode article lives here as a markdown file
- `src/pages/` — top-level page routes (Home, About, Playlists, Contact, Media Kit, Field Sessions, Episodes archive)
- `src/layouts/BaseLayout.astro` — shared page shell (head tags, fonts, header, footer)
- `src/components/` — Header and Footer
- `src/styles/global.css` — design tokens, typography, layout
- `public/` — favicon, logo assets, any other static files served as-is

## Design locks

- Monochrome only: ink `#0A0A0A`, paper `#FFFFFF`, cream `#F5F1EC`
- Fonts: Montserrat Black for headings, Inter for body (loaded from Google Fonts)
- No accent colours, no gradients, no rounded cards

## Contact

`contact@inletwire.com`
