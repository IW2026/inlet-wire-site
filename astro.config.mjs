// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Real last-modified dates for episode + transcript URLs, read straight from
// frontmatter (updated_date, else publish_date). Stamping every URL with the
// build time tells Google every page changed on every deploy, which teaches
// it to ignore lastmod. Pages without a date simply get no lastmod.
function episodeLastmods() {
  const dir = new URL('./src/content/episodes/', import.meta.url);
  const tdir = new URL('./src/content/transcripts/', import.meta.url);
  const map = new Map();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const src = readFileSync(new URL(file, dir), 'utf8');
    if (/^draft:\s*true/m.test(src)) continue;
    const pick = (k) => src.match(new RegExp(`^${k}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
    const date = pick('updated_date') ?? pick('publish_date');
    if (!date) continue;
    const slug = file.replace(/\.md$/, '');
    map.set(`https://inletwire.com/episodes/${slug}/`, date);
    const t = new URL(file, tdir);
    if (existsSync(t)) {
      const tsrc = readFileSync(t, 'utf8');
      const td = tsrc.match(/^transcribed_date:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1];
      map.set(`https://inletwire.com/episodes/${slug}/transcript/`, td && td > date ? td : date);
    }
  }
  // Home and the episode archive change whenever the newest episode lands.
  const newest = [...map.values()].sort().pop();
  if (newest) {
    map.set('https://inletwire.com/', newest);
    map.set('https://inletwire.com/episodes/', newest);
  }
  return map;
}
const lastmods = episodeLastmods();

// https://astro.build/config
export default defineConfig({
  site: 'https://inletwire.com',
  integrations: [
    mdx(),
    sitemap({
      // Hidden pages — never include in sitemap
      // Hidden and noindex pages never go in the sitemap (a noindex URL in the
      // sitemap shows up as an error in Search Console).
      filter: (page) =>
        !page.includes('/portfolio') &&
        !page.includes('/eric_portfolio') &&
        !page.includes('/disclaimer') &&
        !page.includes('/404'),
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        const lm = lastmods.get(item.url);
        if (lm) item.lastmod = new Date(`${lm}T12:00:00Z`).toISOString();
        // Episode pages are the long-tail SEO value — keep them high priority.
        if (item.url.includes('/episodes/') && !item.url.endsWith('/episodes/')) {
          item.changefreq = 'monthly';
          item.priority = 0.9;
        }
        // Homepage sits at the top of the site's priority tree.
        if (item.url === 'https://inletwire.com/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        }
        return item;
      },
    }),
  ],
});
