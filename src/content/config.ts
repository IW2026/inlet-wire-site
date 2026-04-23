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
    tags: z.array(z.string()).default([]),
    apple_podcast_url: z.string().optional(),
    has_transcript: z.boolean().default(false),
    draft: z.boolean().default(false),
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
