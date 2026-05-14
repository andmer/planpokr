// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="svelte-clerk/env" />
/// <reference path="../worker-configuration.d.ts" />

// Stub the generated adapter bundle so TypeScript doesn't try to type-check
// it. `src/worker.ts` re-exports its default `fetch` handler; the bundle is
// emitted at build time and does not live in the type-checked source tree.
declare module '*/.svelte-kit/cloudflare/_worker.js' {
	const handler: ExportedHandler;
	export default handler;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}  // augmented by svelte-clerk
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: Cloudflare.Env;
			cf?: IncomingRequestCfProperties;
			ctx: ExecutionContext;
		}
	}

	namespace Cloudflare {
		// Secrets injected via `wrangler secret put` (and `.dev.vars` in
		// local dev). `wrangler types` doesn't pick these up automatically.
		interface Env {
			ROOM_TOKEN_SECRET: string;
			CLERK_SECRET_KEY: string;
			CLERK_PUBLISHABLE_KEY: string;
		}
	}
}

export {};
