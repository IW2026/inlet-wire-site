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

```
---
title: "Episode headline (short)"
artist: "Artist name"
episode_number: 2
publish_date: 2026-04-28
spotify_episode_id: "paste_spotify_episode_id"
featured_playlist_id: "optional_playlist_id"
description: "One-line description used on cards and for SEO."
tags: ["tag1", "tag2"]
---
```

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
