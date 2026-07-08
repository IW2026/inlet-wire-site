// Region + sound taxonomy for episode browsing.
// Raw frontmatter tags stay as-is (they feed SEO keywords); these curated
// buckets power the visitor-facing filters and related-episode matching.

export function regionForCity(city?: string): string | null {
  if (!city) return null;
  const c = city.toLowerCase().trim();
  const metroVan = [
    "vancouver", "north vancouver", "west vancouver", "burnaby", "richmond",
    "surrey", "new westminster", "coquitlam", "port coquitlam", "port moody",
    "delta", "langley", "maple ridge", "white rock",
  ];
  const island = [
    "victoria", "langford", "nanaimo", "duncan", "courtenay", "comox",
    "campbell river", "tofino", "port alberni", "sidney", "sooke",
  ];
  const seaToSky = ["pemberton", "squamish", "whistler", "lions bay"];
  if (metroVan.includes(c)) return "Metro Vancouver";
  if (island.includes(c)) return "Vancouver Island";
  if (seaToSky.includes(c)) return "Sea to Sky";
  // Interior/Okanagan cities can be added as episodes appear.
  return null;
}

export const GENRE_BUCKETS: Record<string, string[]> = {
  "Indie rock": ["indie-rock", "rock", "garage-rock", "classic-rock", "shoegaze", "post-punk", "alternative"],
  "Pop": ["pop", "indie-pop", "pop-rock"],
  "Folk & singer-songwriter": ["folk", "folk-rock", "indie-folk", "singer-songwriter"],
  "Punk": ["pop-punk", "post-punk"],
  "Studios & production": ["producer", "audio-engineer", "studio", "recording", "production"],
};

export function genresForTags(tags: string[] = []): string[] {
  return Object.entries(GENRE_BUCKETS)
    .filter(([, bucketTags]) => tags.some((t) => bucketTags.includes(t)))
    .map(([genre]) => genre);
}

/** "00:13:30" → "13 min" (rounded down; the show's promise is short episodes). */
export function durationLabel(duration?: string): string | null {
  if (!duration) return null;
  const parts = duration.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  let seconds = 0;
  for (const p of parts) seconds = seconds * 60 + p;
  const mins = Math.floor(seconds / 60);
  return mins > 0 ? `${mins} min` : null;
}
