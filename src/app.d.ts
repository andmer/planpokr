// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="svelte-clerk/env" />

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
}

export {};
