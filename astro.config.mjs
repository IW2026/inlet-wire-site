// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://inletwire.com',
  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
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
