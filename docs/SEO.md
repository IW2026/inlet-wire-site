# Inlet Wire: discovery, listeners, and SEO

How the site gets found, how we know it's turning visitors into listeners, how each episode gets shared, and the routine to keep it going. Written October 2026 on branch `seo-discovery-upgrade`.

The goal is not more indexed pages. It's people finding a BC artist they care about, landing on our interview, and pressing play.

---

## 1. Where things stood (audit, 2026-10-30)

The site already did most of what GoPod pitched: a page per episode with original writing, transcripts (13 as their own pages, 6 inline), listening links, sitemap, structured data, IndexNow, GA4, Search Console verification. No reason to pay for it or rebuild.

### Gaps found, by impact

| # | Gap | Impact | Status |
|---|-----|--------|--------|
| 1 | No way to see which pages turn into listeners. GA4 only had generic outbound clicks. | High | **Fixed**: listen-click tracking (section 2) |
| 2 | Four "Article coming soon" stubs (Hausplants, Chief State, Spendo, Pinebarren). Jody Glenham is thin too. | High | **To do (you)**: needs transcripts, use `npm run prep -- <slug> --article` |
| 3 | 23 of 25 episodes have no `seo_title` / `seo_description`. Most descriptions run 180-500 characters, so Google cuts them off. | Medium-high | Workflow drafts these for review (section 5) |
| 4 | Default share image (home, about, archive, playlists...) was a 3000x3000 square labelled as 1200x630. Previews could crop badly. | Medium | **Fixed**: proper 1200x630 `og-default.jpg`. All 25 episode cards checked, all 1200x630 |
| 5 | Episode schema had no artist entity, so nothing tied the interview to the artist's official profiles. | Medium | **Fixed**: `about` artist with `sameAs` links, location |
| 6 | Sitemap stamped every page with the build time on every deploy. | Medium | **Fixed**: real dates from frontmatter |
| 7 | No sharing kit for artists, no tracked links. | Medium | **Added**: `npm run promo` (section 3) |
| 8 | Archive filters couldn't be linked to, and episode pages didn't lead into them. | Medium | **Fixed**: `/episodes/?region=…&sound=…` + "Browse" links (section 4) |
| 9 | Transcript page descriptions were 270-670 characters. | Low-medium | **Fixed**: trimmed to about 160 |
| 10 | Duplicate artist name in some search titles ("Anna Katarina — Anna Katarina on…"). | Low | **Fixed** |
| 11 | `/disclaimer/` (noindex) was in the sitemap; IndexNow sent 12 transcript URLs that 404. | Low | **Fixed** |
| 12 | Silverware had two H1 headings. | Low | **Fixed** (second one is now H2, same words) |
| 13 | Comox Valley didn't map to Vancouver Island. | Low | **Fixed** |
| 14 | README said Cloudflare, site is on Netlify. | Docs | **Fixed** |

Looked at and left alone: robots.txt (works; `/portfolio` is crawlable by Google but carries `noindex`, which is what keeps it out), the 6 inline transcripts (they index fine in place), full transcript text in structured data (already in the HTML, would just double page weight). The old `speakable` markup was removed from episodes since Google only uses it for news publishers.

---

## 2. Listener conversion (GA4, no new services)

Every episode page, transcript page, the home page and the footer now send these events to the existing GA4 property (`G-MYS9YKGZ3B`). Code: `src/components/ListenTracking.astro`.

| Event | When | Params |
|---|---|---|
| `listen_click` | Spotify, Apple Podcasts, YouTube, iHeart, Pocket Casts, Overcast or the direct audio link | `platform`, `episode_slug`, `link_location` (player, follow_show, footer, home, related…) |
| `audio_play` | the on-page audio player starts (episodes with no Spotify ID) | `episode_slug` |
| `artist_link_click` | the "Find <artist> on" links | `platform` (domain), `episode_slug` |
| `share_click` | the Share button | `episode_slug`, `method` |
| `transcript_open` | transcript link clicked or inline transcript expanded | `episode_slug`, `method` |

Custom names on purpose, so they never double-count GA4's built-in `click` event.

**What it can't see:** plays inside the Spotify embed. Spotify doesn't let other sites see that. Spotify for Podcasters shows total plays, but not where they came from.

### One-time GA4 setup (you, about 10 minutes, needs GA4 admin)

1. Admin → Custom definitions → Create custom dimension (Event scope) for `platform`, `episode_slug`, `link_location`.
2. Admin → Events → mark `listen_click` as a **Key event**. That's the conversion.
3. Admin → Product links → Search Console → link `inletwire.com`.

### The "listener conversion" report

GA4 → Explore → Free form:
- Rows: `Landing page`, then `Session source / medium`
- Values: `Sessions`, `Key events` (listen_click), `Session key event rate`
- Filter: Session default channel group = Organic Search (run it again for Referral and Organic Social)

That gives, per episode page: how many people arrived from Google, and how many went on to listen. Pair it with the Search Console queries for that page (section 6) to see which searches bring real listeners.

### Baseline (do this before merging)

The new events start counting from the deploy. For "before" numbers:
- **GA4** → Reports → Engagement → Events → `click` (built-in outbound clicks, if Enhanced Measurement is on). Add `Link domain` as a secondary dimension and export the last 90 days. That's the pre-change platform-click baseline.
- **GA4** → Reports → Acquisition → Traffic acquisition → last 90 days, export (Organic Search sessions and engagement).
- **Search Console** → Performance → last 3 months → Export, and Pages (Indexing) → note indexed vs not indexed. Run `npm run search-report -- <folder>` on that export and commit the report as the baseline.
- Site-side baseline from this build: 50 pages, 46 in the sitemap, 25 PodcastEpisode, 0 errors; 4 thin episode pages; 2 of 25 with SEO titles.

---

## 3. Sharing and artist promo

- Every episode has a branded 1200x630 share card (`/images/og/ep-NN.jpg`) plus the square cover. All checked for size.
- The Share button already uses the phone's share sheet or copies the link.
- **`npm run promo -- <slug>`** writes `drafts/<slug>/promo/`:
  - `promo.md`: Inlet Wire Instagram caption, a line for the artist to repost, a short post, a newsletter blurb, and a short note to the artist
  - tracked links (`utm_source=artist`, `instagram`, `newsletter`), so GA4 shows which channel brought people in
  - `embed.html`: a small "listen to the interview" block with the Spotify player, for the artist's own site
  - `share-card.jpg` and `square.jpg`
  - It flags a missing or wrong-sized image, a missing `seo_description`, or an episode still in draft.
  - No AI. It only reuses text you approved, so it can't claim anything new about the artist. Edit everything before posting.

### Backlinks, the honest way

The links worth having are the ones that happen naturally: the artist's website or press page, their label, the venue or festival listing, local outlets that cover the same artists. The promo note asks the artist once, no pressure, and gives them the embed. Don't trade links, pay for them, or post them in bulk directories. When an episode has real news value (a festival lineup, a release), a short note to a local outlet is the right kind of outreach.

---

## 4. Artist and topic discovery

### Should every artist get their own page? Not yet.

Every artist so far has exactly one episode. An `/artists/<name>/` page would repeat the episode page with less on it. That's the thin, duplicate kind of page we're avoiding. The episode page already is the artist page: it has the artist's name as the H1, their links, location, and now structured data that tells Google this is about that artist.

**When to add artist pages:** when an artist has two or more things on the site (a return episode, a Waves and Wire session, a standalone article). Then the artist page has a real job: tying those together. Same rule for city or genre hub pages: only when Search Console shows people searching for it (for example "victoria bc bands" growing month over month) and you're willing to write a real intro for it.

### What's in place now

- Archive filters are linkable: `/episodes/?region=Vancouver+Island`, `/episodes/?sound=Indie+rock`. The URL updates as you filter, so it can be shared. Canonical stays `/episodes/`, so no duplicate pages.
- Each episode has a "Browse:" line under More like this (for example "Vancouver Island artists · Indie rock") leading into those filters.
- "More like this" can be hand-picked with `related:` in frontmatter. The automatic matches fill the rest.
- `topics:` in frontmatter feeds structured data, so the subjects of a conversation are machine-readable without stuffing the page.

---

## 5. Publishing workflow (human approval at every step)

```
final episode + corrected transcript
  → npm run prep -- <slug>         AI draft of search title, description, topics, links
  → drafts/<slug>/review.md         you read it, fix or drop anything wrong
  → paste the lines you approve into src/content/episodes/<slug>.md
  → npm run build && npm run seo:check
  → npm run promo -- <slug>         captions, links, images, note to the artist
  → commit + push to main           Netlify builds, sitemap updates, IndexNow pings Bing
  → Search Console: URL Inspection → Request indexing
```

Nothing writes to `src/content`. The scripts only write to `drafts/` (ignored by git). Transcripts and articles are never overwritten.

**Running prep:** `npm run prep -- <slug>` (or `--transcript path/to/final.srt`, add `--article` for a draft article on stub episodes). Free: paste `drafts/<slug>/prompt.md` into Claude, save the JSON reply as `drafts/<slug>/response.json`, run again. Or set `ANTHROPIC_API_KEY` (a few cents an episode).

**What the review sheet checks:** every fact needs exact transcript words behind it, every quote of 4+ words must be verbatim, guests and city must appear in the transcript, unknown names (labels, venues, record titles) get flagged, links must point at real episodes, title/description length, em dashes and promo phrasing. It lowers the risk. It doesn't replace reading it.

**Standalone articles** only when an interview has real material on a subject people search for on its own. The review sheet says yes or no and why. Most of the time it should be no.

### New optional frontmatter

```yaml
updated_date: 2026-11-02   # only for a real edit (new article, transcript added, fact corrected)
artist_type: Person        # MusicGroup (default, bands and solo musicians) | Person (producer/engineer) | Organization (studio, venue, label)
topics: ["songwriting as a journal", "one-man theatre show"]
related: [quadra-sound]
```

Probably `artist_type: Person` for andy-schichter and kaj-falch-nielsen (producers). Confirm before adding. Everyone else is fine on the default.

---

## 6. Using search demand

`npm run search-report -- <unzipped Search Console export>` writes `docs/search-reports/<date>.md`:
- non-brand clicks (the real discovery number) vs people typing "inlet wire"
- searches grouped by episode (artist and guest names)
- BC scene and place searches (the evidence for or against hub pages)
- queries at position 4-20, where a clearer title helps
- pages seen but not clicked (rewrite title/description)
- published episodes with zero impressions (check indexing)

No API, no account linking. Change titles and pages based on this, not on guessed keywords.

---

## 7. Safety and rollback

- All work is on branch `seo-discovery-upgrade`. `main` is untouched.
- Merge only after review. Netlify deploys `main`.
- **Rollback:** before merge, `git switch main`. After merge, either `git revert -m 1 <merge-commit>` and push, or in Netlify → Deploys → pick the previous deploy → "Publish deploy" (instant).
- All episode URLs, transcript URLs, redirects and the RSS feed (Anchor, `/rss`, `/rss.xml`) are unchanged.

### Verified on this branch

- Production build: 50 pages, same 50 URLs as `main`, no errors from `npm run seo:check`.
- Page-by-page comparison with `main`: the only visible changes are the "Browse:" line on 25 episodes, three "More like this" picks shifting (Comox Valley now counts as Vancouver Island), and Silverware's second heading becoming H2. Article text, transcripts, players and links are identical.
- Head changes: shorter transcript descriptions, two de-duplicated titles, default share image.
- Every page has one canonical pointing to itself, the sitemap has no noindex pages and no URLs without a page, all internal links resolve, all JSON-LD parses.

### Still to check after deploy (needs the live site)

- Google Rich Results Test on one episode: https://search.google.com/test/rich-results
- Schema validator: https://validator.schema.org
- Facebook Sharing Debugger on the home page (to refresh the old cached square preview): https://developers.facebook.com/tools/debug/
- GA4 → Admin → DebugView, click a Listen button, confirm `listen_click` shows up.

---

## 8. Needs your accounts

- **GA4**: custom dimensions, key event, Search Console link, baseline export (section 2)
- **Search Console**: confirm verification, resubmit `https://inletwire.com/sitemap-index.xml`, baseline export, Request indexing after deploy
- **Bing Webmaster Tools**: import from Search Console (one click)
- **Spotify for Podcasters / Apple Podcasts Connect**: monthly plays per episode, to compare with listen_click trends

---

## 9. Maintenance routine

**Each new episode (about 20 minutes on top of what you already do)**
1. Corrected transcript into `src/content/transcripts/<slug>.md`
2. `npm run prep -- <slug>` → review → paste what you approve
3. `npm run build && npm run seo:check`
4. `npm run promo -- <slug>` → post, send the note to the artist
5. Push, then Request indexing in Search Console

**Monthly (about 30 minutes)**
1. Export Search Console (3 months) → `npm run search-report -- <folder>` → commit the report
2. GA4 listener conversion exploration → note organic sessions and listen_click for the top pages
3. Fix the top 2-3 items from the report (titles that don't get clicks, near page-one queries)
4. Add a row to the tracking table:

| Month | Non-brand clicks | Impressions | Indexed pages | Organic sessions | listen_click from organic | Top new query |
|---|---|---|---|---|---|---|

**Every few months**
- Revisit hub/artist pages using the rules in section 4
- Fill one or two stub episodes, or add transcripts to older episodes that don't have one
- `npm run seo:check` after any design change
