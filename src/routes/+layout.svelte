<script lang="ts">
  import '../app.css';
  import { ClerkProvider } from 'svelte-clerk';
  let { children, data } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono.css" />
</svelte:head>

<ClerkProvider initialState={data.initialState}>
  {@render children()}
</ClerkProvider>
