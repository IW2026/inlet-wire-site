Transcripts
===========

How to add a transcript for an episode:

1. Create a file in this folder named to match the episode slug.
   Example: if the episode lives at src/content/episodes/hillsboro.md,
   the transcript goes at src/content/transcripts/hillsboro.md.

2. Use this frontmatter:

---
episode_slug: "hillsboro"
artist: "Hillsboro"
title: "Optional — episode title, if you want it to show on the transcript page"
speakers:
  - "Eric Chan"
  - "Hillsboro"
transcribed_date: 2026-04-22
draft: false
---

3. Format the body with speaker names as bold markdown, like:

**Eric:** Thanks for coming on the show.

**Hillsboro:** Thanks for having me.

Optional headers (h2/h3) render as small uppercase section breaks if you
want to group the conversation into chapters.

Optional italicized lines like *[laughter]* or *[0:42]* render as small
grey annotations (timestamps, stage directions).

When a transcript with a matching slug exists and is not a draft, the
episode page will automatically show a "Read the full transcript →" link
near the end of the article body, and the transcript itself is served
at /episodes/<slug>/transcript/.

This README.txt is ignored by Astro's content collection (it isn't a .md file).
