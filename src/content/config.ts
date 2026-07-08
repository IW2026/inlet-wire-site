import { defineCollection, z } from "astro:content";

const episodes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    artist: z.string(),
    episode_number: z.number(),
    publish_date: z.date(),
    spotify_episode_id: z.string().optional(),
    featured_playlist_id: z.string().optional(),
    anchor_audio_url: z.string().optional(),
    description: z.string(),
    // Episode length as "HH:MM:SS" (from the RSS feed's itunes:duration).
    duration: z.string().optional(),
    tags: z.array(z.string()).default([]),
    apple_podcast_url: z.string().optional(),
    has_transcript: z.boolean().default(false),
    hide_photos: z.boolean().default(false),
    draft: z.boolean().default(false),
    // Per-episode platform links — all optional; fall back to show-level URLs if omitted
    youtube_episode_url: z.string().url().optional(),
    iheart_episode_url: z.string().url().optional(),
    // Artist social / web links — all optional
    artist_website: z.string().url().optional(),
    artist_instagram: z.string().url().optional(),
    artist_youtube: z.string().url().optional(),
    artist_facebook: z.string().url().optional(),
    artist_bandcamp: z.string().url().optional(),
    artist_spotify: z.string().url().optional(),
    artist_patreon: z.string().url().optional(),
    // Local SEO / entity fields — data prep only; not yet displayed on site.
    city: z.string().optional(),
    region: z.string().optional(),
    guests: z.array(z.string()).optional(),
    studio: z.string().optional(),
    producer: z.string().optional(),
    // Optional SEO overrides — affect only <title> and meta description, not visible content.
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    // Optional OG image override — root-relative path (e.g. /images/og/ep-01-alt.jpg).
    // Falls back to the auto-derived /images/og/ep-NN.jpg when omitted.
    og_image: z.string().optional(),
    // "From the episode" gallery — editorial carousel slides.
    // Slides with is_cta_slide: true are suppressed on the website
    // (they are Instagram-only CTAs like "Listen on inletwire.com").
    gallery: z.array(z.object({
      src: z.string(),
      alt: z.string(),
      is_cta_slide: z.boolean().default(false),
    })).optional(),
  }),
});

// Transcripts live alongside episodes.
// Filename must match the episode slug (e.g. hillsboro.md → hillsboro.md).
const transcripts = defineCollection({
  type: "content",
  schema: z.object({
    episode_slug: z.string(),
    artist: z.string(),
    title: z.string().optional(),
    // Whom the conversation is between. Used for the transcript header.
    speakers: z.array(z.string()).default(["Eric Chan"]),
    // Optional ISO date for when the transcript itself was finalized.
    transcribed_date: z.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { episodes, transcripts };
