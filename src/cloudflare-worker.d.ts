// Ambient declaration for the SvelteKit Cloudflare adapter's generated Worker
// bundle. The file is emitted to `.svelte-kit/cloudflare/_worker.js` during
// `pnpm build`; it does not exist at type-check time on a clean checkout, so
// `svelte-check` would otherwise fail to resolve the import in `src/worker.ts`.
declare module '../.svelte-kit/cloudflare/_worker.js' {
  const worker: ExportedHandler;
  export default worker;
}
