<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Pcard from '$lib/components/Pcard.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Verdict from '$lib/components/Verdict.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Topbar from '$lib/components/Topbar.svelte';
  import Statusbar from '$lib/components/Statusbar.svelte';
  import Keycap from '$lib/components/Keycap.svelte';
</script>

<Topbar user={{ initial: 'E', name: 'eve' }} live />
<main style="padding:24px;display:grid;gap:16px">
  <div><Button>Reveal cards</Button> <Button variant="ghost">Skip</Button> <Button variant="danger">Kick</Button> <Button variant="danger-solid">Delete</Button></div>
  <div style="display:flex;gap:8px;align-items:flex-end">{#each ['0','1','2','3','5','8','13','21','?','☕'] as v}<Pcard value={v} selected={v === '5'} />{/each}</div>
  <div style="display:flex;gap:6px">
    <Chip initial="A" value="5" role="host" state="consensus" />
    <Chip initial="B" value="8" state="divergent" />
    <Chip initial="E" value="5" role="you" state="consensus" />
  </div>
  <div style="display:flex;gap:8px">
    <Verdict kind="consensus" value="5" />
    <Verdict kind="no-consensus" />
    <Verdict kind="skipped" />
  </div>
  <div style="display:flex;gap:8px"><Avatar initial="A" role="host" /><Avatar initial="B" /><Avatar initial="E" role="you" /></div>
  <div><Keycap>R</Keycap>reveal <Keycap>S</Keycap>skip</div>
</main>
<Statusbar items={[{key: 'R', label: 'reveal'}, {key: 'S', label: 'skip'}]} right="fib · 5 online" />
