import type { PredictionRecord } from "./types";

/** Named simulated starting bankroll. Not a live balance. */
export const SIMULATED_STARTING_BANKROLL = 10000;

export function isBacktestRecord(record: PredictionRecord): boolean {
  return record.source === "demo" || record.id.startsWith("rec-");
}

export function countLiveVsBacktest(records: PredictionRecord[]): {
  live: number;
  backtest: number;
} {
  let live = 0;
  let backtest = 0;
  for (const record of records) {
    if (isBacktestRecord(record)) backtest += 1;
    else live += 1;
  }
  return { live, backtest };
}

export function countOnChainBlobs(records: PredictionRecord[]): number {
  return records.filter((record) => Boolean(record.blobId)).length;
}

/** Current win streak from newest resolved record. A loss resets it to 0. */
export function currentWinStreak(records: PredictionRecord[]): number {
  const resolved = records
    .filter((record) => record.outcome === "ACCURATE" || record.outcome === "FAILED")
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);

  let streak = 0;
  for (const record of resolved) {
    if (record.outcome !== "ACCURATE") break;
    streak += 1;
  }
  return streak;
}

/** Sum of stake on PENDING predictions only. */
export function activeRisk(records: PredictionRecord[]): number {
  return records
    .filter((record) => record.outcome === "PENDING")
    .reduce((sum, record) => sum + (record.stake || 0), 0);
}

/** Simulated balance = named starting bankroll + PnL of resolved records only. */
export function simulatedBalance(
  records: PredictionRecord[],
  starting = SIMULATED_STARTING_BANKROLL
): number {
  const resolvedPnl = records
    .filter((record) => record.outcome === "ACCURATE" || record.outcome === "FAILED")
    .reduce((sum, record) => sum + (record.pnl || 0), 0);
  return starting + resolvedPnl;
}

export function avgStakeOfBankrollPercent(
  records: PredictionRecord[],
  starting = SIMULATED_STARTING_BANKROLL
): number {
  if (records.length === 0 || starting <= 0) return 0;
  const avgStake = records.reduce((sum, record) => sum + (record.stake || 0), 0) / records.length;
  return Number(((avgStake / starting) * 100).toFixed(1));
}
