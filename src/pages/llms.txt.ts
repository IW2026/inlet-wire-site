import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const episodes = (await getCollection("episodes", ({ data }) => !data.draft && data.episode_number < 900))
    .sort((a, b) => a.data.episode_number - b.data.episode_number);

  const episodeLines = episodes
    .map((ep) => {
      const url = `https://inletwire.com/episodes/${ep.slug}/`;
      return `- [Ep. ${ep.data.episode_number} — ${ep.data.artist}: ${ep.data.title}](${url}): ${ep.data.description}`;
    })
    .join("\n");

  const content = `# Inlet Wire

> Inlet Wire is a Canadian music podcast hosted by Eric Chan. Weekly short-form interviews (~10 minutes) with independent artists from British Columbia — your direct line to the artists shaping the sound of Canadian music. New episodes every Monday.

Inlet Wire covers BC artists across genres including indie rock, folk, pop, and alternative. Each episode is an edited, story-forward conversation built to last past the release cycle. The show is an independent media brand based in Metro Vancouver, BC, Canada.

## About

- **Host:** Eric Chan (Metro Vancouver, BC, Canada)
- **Format:** Weekly interview podcast, approximately 10 minutes per episode
- **Focus:** Independent artists from British Columbia, Canada
- **Tagline:** Your direct line to BC artists
- **Editorial stance:** Time-capsule journalism — no rankings, no hype cycles, no promo-speak. Artists talking about their work with someone who cares about getting it right.
- **Website:** https://inletwire.com
- **Contact:** contact@inletwire.com
- **RSS Feed:** https://anchor.fm/s/10edfd0cc/podcast/rss
- **Started:** February 2026

## Host

Eric Chan is a producer, audio engineer, and music curator based in Metro Vancouver. BCIT Radio Arts & Entertainment and SAE Institute Recording Arts graduate, with over 20 years around music, production, and entertainment. His background spans independent music scenes in Asia, Australia, and Canada.

## Listen

- Spotify: https://open.spotify.com/show/2BTlbhjjXBsV6MECUSUWwY
- Apple Podcasts: https://podcasts.apple.com/podcast/id1876137985
- iHeartRadio: https://www.iheart.com/podcast/1333-inlet-wire-322764626/
- Pocket Casts: https://pca.st/itunes/1876137985
- Overcast: https://overcast.fm/itunes1876137985
- YouTube: https://www.youtube.com/@inletwire
- RSS: https://anchor.fm/s/10edfd0cc/podcast/rss

## Social

- Instagram: https://www.instagram.com/inletwire
- TikTok: https://www.tiktok.com/@inletwire
- Facebook: https://www.facebook.com/inletwire
- YouTube: https://www.youtube.com/@inletwire

## Pages

- [Home](https://inletwire.com/): Latest episode, recent episodes archive, BC artist playlists
- [Episodes](https://inletwire.com/episodes/): Full archive of all Inlet Wire episodes
- [Playlists](https://inletwire.com/playlists/): Spotify playlists — The Sound of BC (featured artists) and Full Episodes
- [About](https://inletwire.com/about/): About Inlet Wire and host Eric Chan
- [Contact](https://inletwire.com/contact/): Press, sponsorship, and artist submissions
- [Media Kit](https://inletwire.com/media-kit/): Brand assets and sponsorship information

## Episodes

${episodeLines}
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
