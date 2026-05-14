// Pure stats helpers for a revealed vote round. Imported by both the RoomDO
// (live reveal payload) and the history page (audit replay), so the
// median/range/verdict shown to users matches what was broadcast at the time.

export type RevealStats = {
  median: string;
  range: string;
  verdict: 'consensus' | 'no-consensus';
};

/**
 * Compute median/range/verdict from a `userId → value` vote map.
 * - Non-numeric values (e.g. T-shirt sizes) are excluded from median/range,
 *   which fall back to `?` when there is no numeric data.
 * - Verdict is `consensus` iff every voter cast the same raw value (numeric
 *   or otherwise); otherwise `no-consensus`.
 */
export function computeStats(votes: Record<string, string>): RevealStats {
  const all = Object.values(votes);
  const numeric = all.filter((v) => /^\d+$/.test(v)).map(Number);
  numeric.sort((a, b) => a - b);
  if (!numeric.length) {
    return { median: '?', range: '?', verdict: 'no-consensus' };
  }
  const median = numeric[Math.floor(numeric.length / 2)];
  const lo = numeric[0];
  const hi = numeric[numeric.length - 1];
  return {
    median: String(median),
    range: lo === hi ? String(lo) : `${lo}–${hi}`,
    verdict: new Set(all).size === 1 ? 'consensus' : 'no-consensus'
  };
}
