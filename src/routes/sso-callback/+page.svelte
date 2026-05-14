<script lang="ts">
  import { AuthenticateWithRedirectCallback } from 'svelte-clerk';
</script>

<AuthenticateWithRedirectCallback />

<main style="display:grid;place-items:center;min-height:60vh">
  <p style="color:var(--color-mid);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Signing you in…</p>
</main>
