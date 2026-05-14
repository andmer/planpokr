<script lang="ts">
  import PaneHead from '$lib/components/PaneHead.svelte';
  import type { Story } from '$lib/types';
  import type { ClientMsg } from '$lib/do/messages';
  import type { LiveCurrent } from '$lib/ws/client';

  interface Props {
    roomId: string;
    stories: Story[];
    current: LiveCurrent | null;
    isHost: boolean;
    send: (m: ClientMsg) => void;
  }
  let { roomId, stories, current, isHost, send }: Props = $props();

  let adding = $state(false);
  let newTitle = $state('');
  let newDesc = $state('');
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  async function addStory() {
    if (!newTitle.trim() || saving) return;
    saving = true;
    saveError = null;
    try {
      const res = await fetch(`/api/rooms/${roomId}/stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc })
      });
      if (!res.ok) {
        saveError = `error ${res.status}`;
        return;
      }
      newTitle = '';
      newDesc = '';
      adding = false;
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'failed';
    } finally {
      saving = false;
    }
  }

  function startRound(storyId: string) {
    if (!isHost) return;
    if (current?.storyId === storyId) return;
    send({ type: 'start_round', storyId });
  }
</script>

<aside class="pane">
  <PaneHead hint="host">Stories</PaneHead>

  {#if stories.length === 0}
    <p class="empty">No stories yet.</p>
  {/if}

  {#each stories as story (story.id)}
    <button
      type="button"
      class="story"
      class:active={current?.storyId === story.id}
      class:pending={story.status === 'pending'}
      class:voting={story.status === 'voting'}
      class:estimated={story.status === 'estimated'}
      class:skipped={story.status === 'skipped'}
      class:host-clickable={isHost}
      disabled={!isHost}
      onclick={() => startRound(story.id)}
    >
      <span class="prefix">{current?.storyId === story.id ? '▸' : '·'}</span>
      <span class="name">{story.title}</span>
      <span class="pts">
        {story.final_estimate ?? (story.status === 'voting' ? '···' : story.status === 'skipped' ? '—' : '·')}
      </span>
    </button>
  {/each}

  {#if isHost}
    <div class="add-wrap">
      {#if !adding}
        <button type="button" class="add" onclick={() => (adding = true)}>＋ add story</button>
      {:else}
        <input
          placeholder="Story title"
          bind:value={newTitle}
          onkeydown={(e) => {
            if (e.key === 'Enter') addStory();
            else if (e.key === 'Escape') {
              adding = false;
              newTitle = '';
              newDesc = '';
            }
          }}
        />
        <textarea placeholder="Description (optional)" rows="2" bind:value={newDesc}></textarea>
        {#if saveError}<p class="err">{saveError}</p>{/if}
        <div class="add-ctrl">
          <button type="button" class="save" onclick={addStory} disabled={saving}>Save</button>
          <button
            type="button"
            class="cancel"
            onclick={() => {
              adding = false;
              newTitle = '';
              newDesc = '';
              saveError = null;
            }}>Cancel</button
          >
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .pane {
    background: linear-gradient(180deg, var(--color-panel) 0%, rgb(20 20 22 / 0.92) 100%);
    border-right: 1px solid var(--color-hairline);
    padding: 22px 22px 24px;
    position: relative;
  }
  .pane::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-hairline-strong) 30%,
      var(--color-hairline-strong) 70%,
      transparent
    );
  }
  .empty {
    color: var(--color-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    margin: 4px 0 12px;
  }
  .story {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    margin: 0 -10px 1px;
    border-radius: 5px;
    cursor: default;
    font-weight: 600;
    color: var(--color-text);
    width: calc(100% + 20px);
    text-align: left;
    background: transparent;
    border: none;
  }
  .story.host-clickable {
    cursor: pointer;
  }
  .story.host-clickable:hover {
    background: var(--color-panel-2);
    color: var(--color-bright);
  }
  .story.active {
    background: linear-gradient(90deg, rgb(233 184 107 / 0.1), rgb(233 184 107 / 0.04));
    color: var(--color-bright);
    box-shadow: inset 2px 0 0 var(--color-amber);
    font-weight: 700;
  }
  .prefix {
    color: var(--color-dim);
  }
  .story.active .prefix {
    color: var(--color-amber);
    font-weight: 800;
  }
  .name {
    flex: 1;
  }
  .pts {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--color-green, var(--color-go));
    min-width: 22px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .story.pending .pts {
    color: var(--color-dim);
  }
  .story.voting .pts {
    color: var(--color-amber);
  }
  .story.skipped .pts {
    color: var(--color-dim);
  }
  .add-wrap {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .add {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 11px;
    background: transparent;
    border: none;
    padding: 6px 0;
    cursor: pointer;
    text-align: left;
  }
  .add:hover {
    color: var(--color-bright);
  }
  input,
  textarea {
    background: var(--color-bg-2);
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-bright);
    padding: 8px 10px;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: 12px;
    width: 100%;
  }
  textarea {
    resize: vertical;
    min-height: 44px;
  }
  .add-ctrl {
    display: flex;
    gap: 6px;
  }
  .save,
  .cancel {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    border: 1px solid var(--color-hairline-strong);
    background: var(--color-bg-2);
    color: var(--color-bright);
  }
  .save {
    background: linear-gradient(180deg, var(--color-go-bright), var(--color-go));
    border-color: var(--color-go);
    color: var(--color-bright);
  }
  .save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .err {
    color: var(--color-stop);
    font-family: var(--font-mono);
    font-size: 11px;
    margin: 0;
  }
</style>
