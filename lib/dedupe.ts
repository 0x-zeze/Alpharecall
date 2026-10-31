import type { PredictionRecord } from "./types";

/**
 * Checks whether a prediction record has reached a finalized outcome.
 */
export function isResolvedOutcome(outcome?: string): boolean {
  return outcome === "ACCURATE" || outcome === "FAILED";
}

/**
 * Compares current winner and candidate to decide if candidate should replace current winner.
 * Priority rules:
 * 1. Resolved (ACCURATE / FAILED) strictly beats PENDING.
 * 2. If resolution status is equal (both resolved or both pending):
 *    The record with the newest timestamp wins.
 * 3. If timestamps are equal or uncomparable:
 *    Retain the current winner (earlier appearance) for determinism.
 * 4. Two resolved records with different outcomes:
 *    The one with the newest timestamp wins without crashing.
 */
function shouldReplaceWinner(currentWinner: PredictionRecord, candidate: PredictionRecord): boolean {
  const currentResolved = isResolvedOutcome(currentWinner.outcome);
  const candidateResolved = isResolvedOutcome(candidate.outcome);

  // 1. Resolved beats pending
  if (candidateResolved && !currentResolved) {
    return true;
  }
  if (!candidateResolved && currentResolved) {
    return false;
  }

  // 2. Both resolved or both pending: compare timestamps
  const tCurr =
    typeof currentWinner.timestamp === "number" && !isNaN(currentWinner.timestamp)
      ? currentWinner.timestamp
      : 0;
  const tCand =
    typeof candidate.timestamp === "number" && !isNaN(candidate.timestamp)
      ? candidate.timestamp
      : 0;

  if (tCand > tCurr) {
    return true;
  }

  // Tie or older: keep current winner for determinism
  return false;
}

/**
 * Merges non-empty metadata fields from non-winning records into the winning record.
 * Priority remains with the winner's fields; non-winning records fill in any
 * missing (undefined, null, empty string, or empty array) fields.
 */
function mergeRecordFields(winner: PredictionRecord, other: PredictionRecord): PredictionRecord {
  const merged: PredictionRecord = { ...winner };

  const keys = Object.keys(other) as (keyof PredictionRecord)[];
  for (const k of keys) {
    const wVal = merged[k];
    const oVal = other[k];

    const isWinnerEmpty =
      wVal === undefined ||
      wVal === null ||
      wVal === "" ||
      (Array.isArray(wVal) && wVal.length === 0);

    const isOtherNonEmpty =
      oVal !== undefined &&
      oVal !== null &&
      oVal !== "" &&
      (!Array.isArray(oVal) || oVal.length > 0);

    if (isWinnerEmpty && isOtherNonEmpty) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[k] = oVal;
    }
  }

  return merged;
}

/**
 * Deduplicates an array of prediction records by `id`.
 * Guarantees:
 * - Exactly one record per `id`.
 * - Resolved beats pending.
 * - Newest timestamp breaks ties.
 * - Non-empty metadata from pending (odds, stake, reasoning, deadline, etc.) is preserved.
 * - Stable output order (order of first appearance of each `id`).
 */
export function dedupePredictions(records: PredictionRecord[]): PredictionRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const order: string[] = [];
  const groups = new Map<string, PredictionRecord[]>();

  for (const r of records) {
    if (!r || typeof r.id !== "string") continue;
    if (!groups.has(r.id)) {
      groups.set(r.id, []);
      order.push(r.id);
    }
    groups.get(r.id)!.push(r);
  }

  const result: PredictionRecord[] = [];

  for (const id of order) {
    const list = groups.get(id)!;
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }

    // Determine the winning record
    let winner = list[0];
    for (let i = 1; i < list.length; i++) {
      if (shouldReplaceWinner(winner, list[i])) {
        winner = list[i];
      }
    }

    // Merge metadata from all other records in the group
    let merged = { ...winner };
    for (const other of list) {
      if (other === winner) continue;
      merged = mergeRecordFields(merged, other);
    }

    result.push(merged);
  }

  return result;
}
