// Cloudflare Worker entry point — referenced by `wrangler.toml` `main`.
//
// adapter-cloudflare emits the SvelteKit Worker to
// `.svelte-kit/cloudflare/_worker.js`. We import that bundle as the
// default `fetch` handler and re-export the `RoomDO` class so that
// Wrangler can wire the Durable Object binding declared in
// `wrangler.toml` (`class_name = "RoomDO"`).
//
// The adapter's output location is controlled via a separate
// `wrangler.adapter.toml` referenced by `svelte.config.js`, so the
// adapter does not overwrite this file.

// Cloudflare Worker entry point — referenced by `wrangler.toml` `main`.
//
// `adapter-cloudflare` emits the SvelteKit Worker to
// `.svelte-kit/cloudflare/_worker.js` during `pnpm build`. We re-export its
// default `fetch` handler and add the `RoomDO` class as a named export so
// that Wrangler can wire the Durable Object binding declared in
// `wrangler.toml` (`class_name = "RoomDO"`).
//
// The adapter writes its bundle to the path declared in `wrangler.adapter.toml`
// — referenced by `svelte.config.js` — leaving this file untouched.

import worker from '../.svelte-kit/cloudflare/_worker.js';

export { RoomDO } from './lib/do/RoomDO';
export default worker;
