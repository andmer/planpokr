<script lang="ts">
  import { GoogleOneTap } from 'svelte-clerk';
  import Topbar from '$lib/components/Topbar.svelte';
  import Button from '$lib/components/Button.svelte';
  import { goto } from '$app/navigation';

  let { data } = $props();

  const nav = $derived(
    data.signedIn
      ? [{ label: 'Rooms', active: true }, { label: 'History' }, { label: 'Settings' }]
      : []
  );

  // The classic Fibonacci-ish deck planpokr ships (matches src/routes/r/[roomId]/+page.svelte).
  const fibDeck = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

  // What each card "feels like" in practice. Deliberately framed in terms of
  // complexity/risk, not hours — relative sizing is the whole point.
  const cardMeanings = [
    { v: '0',  label: 'Already done',     body: "Trivially nothing — config tweak, copy change, or work that's secretly already complete." },
    { v: '1',  label: 'Tiny',             body: 'A focused hour or two. No surprises, no unknowns, one file in your head.' },
    { v: '2',  label: 'Small',            body: 'Half a day-ish. Slightly bigger surface, but the path is obvious.' },
    { v: '3',  label: 'Modest',           body: 'Around a day. Touches a couple of pieces, but still well-understood.' },
    { v: '5',  label: 'Real chunk',       body: 'Multiple days. Some moving parts, maybe minor unknowns, worth a quick design check.' },
    { v: '8',  label: 'Big',              body: 'A week-ish of focused work. Real coordination, real risk. Discuss before committing.' },
    { v: '13', label: 'Very big',         body: "Borderline too big. Strongly consider splitting — if you can't, plan for surprises." },
    { v: '21', label: 'Too big',          body: "Almost always means you don't fully understand the work yet. Split it or run a spike first." },
    { v: '?',  label: 'Need info',        body: "You can't estimate this honestly without more detail. Stop the round and clarify." },
    { v: '☕', label: 'Need a break',     body: "Coffee card. No shame — fatigue produces bad estimates faster than ignorance does." }
  ];
</script>

<Topbar {nav} showUserButton={data.signedIn} showAuthCTAs={!data.signedIn} />

{#if !data.signedIn}
  <!-- Show the One Tap prompt on landing so signed-in Google users skip the
       full-page redirect entirely. Falls back to /sign-in if dismissed. -->
  <GoogleOneTap signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />

  <main class="landing">
    <section class="hero hairline-top">
      <h1>planpokr</h1>
      <p class="tagline">Real-time planning poker for your team.</p>
    </section>

    <section class="how">
      <h2>How planning poker works</h2>
      <p class="lede">
        Planning poker is a structured way for a team to estimate work together without
        the loudest or most senior person dragging everyone toward their number. Everyone
        votes privately, all at once, then reveals — and the disagreement itself becomes
        the most useful signal.
      </p>

      <h3 class="subhead">The flow of a single round</h3>
      <ol class="steps">
        <li>
          <span class="step-num">1</span>
          <div>
            <h3>Spin up a room</h3>
            <p>
              The host creates a room and shares the link. Anyone with the link joins
              instantly — no install, no account juggling. The host queues up the stories
              you're going to estimate.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">2</span>
          <div>
            <h3>Introduce the story</h3>
            <p>
              The host names the story and gives a quick context — what's being built,
              what "done" looks like, known constraints. Anyone can ask clarifying
              questions before voting starts. This is where missing information surfaces.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">3</span>
          <div>
            <h3>Vote privately</h3>
            <p>
              Each person picks a card based on their <em>own</em> read of the work —
              not what they think their teammates will pick, not what sounds politically
              safe. Cards stay hidden until everyone has voted. No anchoring on the
              first number out loud, no quiet bandwagoning.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">4</span>
          <div>
            <h3>Reveal &amp; discuss</h3>
            <p>
              Flip the cards. The <em>spread</em> is the actual product of this exercise.
              If everyone landed in the same neighborhood, you're done. If there's a real
              gap, the highest and lowest voters explain their reasoning first — they
              usually know something the others don't.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">5</span>
          <div>
            <h3>Re-vote if you didn't converge</h3>
            <p>
              After the discussion, vote again. Most rounds converge after one re-vote.
              If you're still split after two or three, that's a signal: the story isn't
              well-defined enough to estimate, or it's hiding multiple stories inside it.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">6</span>
          <div>
            <h3>Lock it in, move on</h3>
            <p>
              The agreed estimate sticks to the story. Don't go back and "correct" it
              after the work is done — story points are a planning tool, not a
              performance metric. Move to the next story.
            </p>
          </div>
        </li>
      </ol>

      <h3 class="subhead">Common scenarios</h3>
      <div class="scenarios">
        <div class="scenario">
          <span class="scenario-tag tag-good">Everyone agrees</span>
          <p>
            Lock it in immediately. Don't manufacture discussion to feel thorough — if
            the team converged, the team converged.
          </p>
        </div>
        <div class="scenario">
          <span class="scenario-tag tag-warn">Wide spread (e.g. 2 and 13)</span>
          <p>
            Highest and lowest voters explain first. The high voter is usually seeing a
            risk or hidden complexity the others missed; the low voter is often seeing
            an existing solution or shortcut. Both are useful.
          </p>
        </div>
        <div class="scenario">
          <span class="scenario-tag tag-warn">Stuck after 2–3 re-votes</span>
          <p>
            The story isn't well-formed. Either split it into smaller stories that
            <em>are</em> estimable, or timebox a short spike to remove the unknowns
            before re-estimating.
          </p>
        </div>
        <div class="scenario">
          <span class="scenario-tag tag-info">Someone votes <span class="card-inline">?</span></span>
          <p>
            Pause and clarify. A single "?" means at least one teammate doesn't have
            enough information to guess honestly — pushing through anyway just produces
            an estimate that nobody trusts.
          </p>
        </div>
        <div class="scenario">
          <span class="scenario-tag tag-info">Someone votes <span class="card-inline">☕</span></span>
          <p>
            Take a break. Tired teams produce bad estimates and worse decisions. Five
            minutes back is cheaper than a week of misplanned work.
          </p>
        </div>
      </div>

      <div class="tips-grid">
        <div class="tips-block">
          <h3 class="subhead">Tips for hosts</h3>
          <ul class="tips">
            <li><strong>Timebox discussion.</strong> 2–3 minutes per story usually. Endless debate is the enemy of estimation.</li>
            <li><strong>Don't vote and host.</strong> If you're driving the conversation, you're already anchoring — stay neutral.</li>
            <li><strong>Read the spread, not just the mode.</strong> A unanimous 5 and a "5, 5, 5, 13" both have a "5" — but they mean very different things.</li>
            <li><strong>If a story keeps growing, split it.</strong> Anything 13+ should make you nervous. 21+ means you almost certainly don't understand it yet.</li>
          </ul>
        </div>
        <div class="tips-block">
          <h3 class="subhead">Tips for voters</h3>
          <ul class="tips">
            <li><strong>Vote based on your own knowledge.</strong> If you'd be the one doing this work, what would <em>you</em> guess?</li>
            <li><strong>Don't bid for popularity.</strong> A defensible outlier is worth more than a comfortable middle.</li>
            <li><strong>"?" is a real answer.</strong> "I don't know enough" is more honest than a number you don't believe.</li>
            <li><strong>Estimate complexity and risk, not hours.</strong> Two stories that take the same time can have very different uncertainty profiles.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="fib-block">
      <h2>Why Fibonacci?</h2>
      <p class="fib-lede">
        The cards aren't a continuous scale — they're a sequence where each number is the
        sum of the previous two. That spacing isn't decorative; it's doing real cognitive
        work.
      </p>

      <div class="fib-cards" aria-hidden="true">
        {#each fibDeck as v}
          <span class="fib-card">{v}</span>
        {/each}
      </div>

      <h3 class="subhead">Story points are relative, not absolute</h3>
      <p>
        A "5" doesn't mean 5 hours, or 5 days, or any unit of clock time. It means
        "about 5× as much work as our reference 1." Teams pick a small, well-understood
        story everyone agrees is a "1" or a "3," and estimate everything else relative
        to that. This is why you can't compare velocity across teams — each team's "5"
        is calibrated to a different reference.
      </p>

      <h3 class="subhead">The spacing matches how humans perceive size</h3>
      <p>
        Each card is roughly <strong>1.6×</strong> the previous (the golden ratio,
        which is what Fibonacci ratios converge to). That exponential spacing maps
        onto how human perception actually works — Weber-Fechner: we perceive
        differences proportionally, not linearly. The jump from 1 to 2 <em>feels</em>
        like the same step as the jump from 8 to 13, because both double-ish.
      </p>

      <ul class="fib-points">
        <li>
          <strong>Estimates aren't precise.</strong>
          The difference between a 5 and a 6 is noise. The difference between a 5 and
          an 8 is real. Removing 6, 7, 9, 10 from the deck stops the team from arguing
          about precision they don't have.
        </li>
        <li>
          <strong>Gaps grow with size, just like uncertainty does.</strong>
          For tiny stories you can tell 1 from 2 — the work fits in your head. For big
          ones you can't tell 20 from 25, but you <em>can</em> tell 13 from 21. The
          scale stretches exactly where your confidence starts to fall apart.
        </li>
        <li>
          <strong>Forces a decision.</strong>
          No middle ground means "is this a 5 or an 8?" actually has to be resolved
          instead of everyone hiding at 6.5. That conversation — "what would push it
          from 5 to 8?" — is where the real signal is.
        </li>
        <li>
          <strong>Discourages false precision.</strong>
          A linear 1–10 scale gives you ten rungs that all look equally meaningful and
          tempts people to argue 6 vs. 7. Fibonacci's gaps make small distinctions at
          the high end literally unrepresentable, so the team stops pretending.
        </li>
      </ul>

      <h3 class="subhead">What each card means in practice</h3>
      <p class="fib-lede">
        Rough framing — your team will calibrate to its own reality. Worth printing
        and sharing with new joiners.
      </p>
      <ul class="card-meanings">
        {#each cardMeanings as c}
          <li>
            <span class="card-meaning-card">{c.v}</span>
            <div>
              <h4>{c.label}</h4>
              <p>{c.body}</p>
            </div>
          </li>
        {/each}
      </ul>

      <h3 class="subhead">Common pitfalls</h3>
      <ul class="fib-points">
        <li>
          <strong>Mapping points to hours.</strong>
          The moment "5 = 5 hours" becomes a rule, story points are now just hours
          with extra steps — and you've lost the ability to express uncertainty.
        </li>
        <li>
          <strong>Comparing velocity across teams.</strong>
          Different teams calibrate their reference "1" differently. Team A's 30-point
          sprint and Team B's 60-point sprint say nothing about who's faster.
        </li>
        <li>
          <strong>Inflating estimates "for safety."</strong>
          If everyone pads, the points stop reflecting relative size and just reflect
          everyone's anxiety. Estimate honestly; manage risk separately.
        </li>
        <li>
          <strong>Re-estimating after the work is done.</strong>
          Story points are a planning input, not a scorecard. Adjusting them
          retroactively destroys the historical signal you'd use to plan future sprints.
        </li>
      </ul>
    </section>
  </main>
{:else}
  <main class="rooms-wrap">
    <header class="rooms-head">
      <h1>Your rooms</h1>
      <span class="count">{data.rooms.length} rooms</span>
      <Button onclick={() => goto('/rooms/new')}>＋ New room</Button>
    </header>

    {#if data.rooms.length === 0}
      <p class="empty">No rooms yet. Create one to get started.</p>
    {:else}
      <div class="room-grid">
        {#each data.rooms as room (room.id)}
          <a href="/r/{room.id}" class="room-card">
            <div class="room-row">
              <span class="room-name">{room.name}</span>
              <span class="room-slug">{room.id}</span>
            </div>
            <div class="room-meta">
              <span>deck: {room.deck}</span>
              {#if room.estimated_count > 0}
                <span class="meta-dot">·</span>
                <span class="room-points">
                  {Number(room.total_points).toFixed(0)} pts
                </span>
                <span class="meta-dot">·</span>
                <span>{room.estimated_count}/{room.story_count} estimated</span>
              {:else if room.story_count > 0}
                <span class="meta-dot">·</span>
                <span>{room.story_count} {room.story_count === 1 ? 'story' : 'stories'}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </main>
{/if}

<style>
  .landing {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 24px 96px;
    display: flex;
    flex-direction: column;
    gap: 56px;
  }
  .hero {
    text-align: center;
    padding: 56px 40px;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
  }
  .hero h1 {
    font-size: var(--text-display);
    font-weight: 800;
    letter-spacing: -0.035em;
    color: var(--color-bright);
    margin: 0 0 8px;
  }
  .hero .tagline {
    color: var(--color-mid);
    font-size: 13px;
    margin: 0;
  }

  .how h2,
  .fib-block h2 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--color-bright);
    margin: 0 0 16px;
  }
  .lede {
    color: var(--color-text);
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 32px;
    max-width: 64ch;
  }
  .subhead {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-mid);
    margin: 32px 0 16px;
    font-family: var(--font-mono);
  }
  .fib-block .subhead:first-of-type { margin-top: 24px; }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0 0 56px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .steps li {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 16px;
    align-items: start;
  }
  .step-num {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: var(--color-panel-2);
    border: 1px solid var(--color-hairline-strong);
    border-radius: 50%;
    color: var(--color-bright);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
  }
  .steps h3 {
    margin: 4px 0 6px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--color-bright);
  }
  .steps p {
    margin: 0;
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.6;
  }
  .steps em, .scenarios em, .fib-points em, .card-meanings em {
    font-style: italic;
    color: var(--color-bright);
  }

  .scenarios {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0 0 16px;
  }
  .scenario {
    padding: 14px 16px;
    background: var(--color-panel);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
  }
  .scenario p {
    margin: 8px 0 0;
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.55;
  }
  .scenario-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
  }
  .tag-good {
    color: var(--color-go);
    background: rgb(45 211 95 / 0.10);
    border-color: rgb(45 211 95 / 0.25);
  }
  .tag-warn {
    color: var(--color-amber);
    background: rgb(233 184 107 / 0.10);
    border-color: rgb(233 184 107 / 0.25);
  }
  .tag-info {
    color: var(--color-cyan);
    background: rgb(130 215 255 / 0.08);
    border-color: rgb(130 215 255 / 0.20);
  }

  .tips-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    margin-top: 8px;
  }
  .tips-block {
    padding: 18px 20px;
    background: var(--color-panel);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
  }
  .tips-block .subhead { margin-top: 0; }
  .tips {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tips li {
    color: var(--color-text);
    font-size: 12.5px;
    line-height: 1.55;
    padding-left: 14px;
    position: relative;
  }
  .tips li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-mid);
  }
  .tips strong { color: var(--color-bright); font-weight: 700; }
  .tips em { font-style: italic; color: var(--color-bright); }
  @media (max-width: 640px) {
    .tips-grid { grid-template-columns: 1fr; }
  }

  .fib-block {
    padding: 32px;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
  }
  .fib-block h2 { margin-top: 0; }
  .fib-lede {
    color: var(--color-text);
    font-size: 13.5px;
    line-height: 1.55;
    margin: 0 0 20px;
  }
  .fib-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 24px;
  }
  .fib-card {
    min-width: 38px;
    height: 50px;
    display: grid;
    place-items: center;
    background: var(--color-panel-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-bright);
    padding: 0 8px;
  }
  .fib-points {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .fib-points li {
    color: var(--color-text);
    font-size: 13px;
    line-height: 1.55;
    padding-left: 14px;
    position: relative;
  }
  .fib-points li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-go);
  }
  .fib-points strong {
    color: var(--color-bright);
    font-weight: 700;
  }
  .fib-points em {
    font-style: italic;
    color: var(--color-bright);
  }
  .fib-block p {
    color: var(--color-text);
    font-size: 13.5px;
    line-height: 1.6;
    margin: 0 0 16px;
  }
  .fib-block p strong { color: var(--color-bright); font-weight: 700; }
  .fib-block p em { font-style: italic; color: var(--color-bright); }

  .card-meanings {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card-meanings li {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 14px;
    align-items: start;
    padding: 12px 14px;
    background: var(--color-panel);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
  }
  .card-meaning-card {
    width: 48px;
    height: 60px;
    display: grid;
    place-items: center;
    background: var(--color-panel-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 700;
    color: var(--color-bright);
  }
  .card-meanings h4 {
    margin: 4px 0 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.01em;
  }
  .card-meanings p {
    margin: 0;
    color: var(--color-text);
    font-size: 12.5px;
    line-height: 1.55;
  }
  .card-inline {
    display: inline-block;
    min-width: 18px;
    padding: 1px 6px;
    background: var(--color-panel-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-bright);
    line-height: 1.4;
    text-align: center;
  }
  .rooms-wrap {
    padding: 36px 40px;
  }
  .rooms-head {
    display: flex;
    align-items: baseline;
    gap: 18px;
    margin-bottom: 32px;
  }
  .rooms-head h1 {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-bright);
    margin: 0;
  }
  .count {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .empty {
    color: var(--color-mid);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .room-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .room-card {
    padding: 18px 20px;
    display: block;
    background: linear-gradient(180deg, var(--color-panel), var(--color-panel-2));
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    text-decoration: none;
    color: inherit;
    transition:
      transform 0.15s,
      border-color 0.15s;
  }
  .room-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-hairline-strong);
  }
  .room-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .room-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-bright);
    letter-spacing: -0.02em;
  }
  .room-slug {
    font-family: var(--font-mono);
    color: var(--color-cyan);
    font-size: 11px;
    font-weight: 600;
    background: rgb(130 215 255 / 0.08);
    border: 1px solid rgb(130 215 255 / 0.2);
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    margin-left: auto;
  }
  .room-meta {
    color: var(--color-mid);
    font-size: 12px;
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .room-meta .meta-dot {
    color: var(--color-dim);
  }
  .room-points {
    color: var(--color-go);
    font-weight: 700;
    background: rgb(45 211 95 / 0.08);
    border: 1px solid rgb(45 211 95 / 0.25);
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }
</style>
