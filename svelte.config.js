import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Adapter writes its bundle to the `main` declared in this config.
      // We deliberately keep that pointed at `.svelte-kit/cloudflare/_worker.js`
      // (in `wrangler.adapter.toml`) so the real `wrangler.toml` can use
      // `src/worker.ts` as its entry and re-export the `RoomDO` class.
      config: 'wrangler.adapter.toml',
      routes: { include: ['/*'], exclude: ['<all>'] }
    })
  }
};
