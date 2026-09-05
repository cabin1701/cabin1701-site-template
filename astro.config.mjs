// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://cabin1701.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
  redirects: {
    '/ja/report/five-chapters/': '/report/five-chapters/',
    '/ja/report/eleos-where-is-the-mind/': '/report/eleos-where-is-the-mind/',
    '/es/report/five-chapters/': '/report/five-chapters/',
    '/es/report/eleos-where-is-the-mind/': '/report/eleos-where-is-the-mind/',
  },
});
