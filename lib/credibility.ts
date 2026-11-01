import type { PredictionRecord, PredictionCategory } from "./types";
import { dedupePredictions } from "./dedupe";

export { dedupePredictions } from "./dedupe";

export const MIN_CREDIBILITY_WEIGHT = 0.4;
export const MAX_CREDIBILITY_WEIGHT = 2.4;
export const BASE_CREDIBILITY_WEIGHT = 1.0;
export const DELTA_DIVISOR = 20;

export interface ForecasterCategoryStats {
  category: PredictionCategory;
  totalPicks: number;
  wins: number;
  losses: number;
  winRate: number;
  delta: number;
}

export interface ForecasterAnalysis {
  handle: string;
  category: PredictionCategory;
  totalPicks: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number; // 0 to 100 percentage
  deltaTotal: number;
  weightMultiplier: number; // bounded between MIN_CREDIBILITY_WEIGHT and MAX_CREDIBILITY_WEIGHT
  netPnl: number;
  recent: ("W" | "L")[];
  categoryBreakdown: Record<string, ForecasterCategoryStats>;
  verifiedBlobs: string[];
}

/**
 * Pure mathematical calculation of credibility weight from accumulated score deltas.
 * Formula: Weight = max(0.40, min(2.40, 1.0 + deltaTotal / 20))
 */
export function computeWeight(
  deltaTotal: number,
  minWeight = MIN_CREDIBILITY_WEIGHT,
  maxWeight = MAX_CREDIBILITY_WEIGHT
): number {
  if (isNaN(deltaTotal)) return BASE_CREDIBILITY_WEIGHT;
  const raw = BASE_CREDIBILITY_WEIGHT + deltaTotal / DELTA_DIVISOR;
  const clamped = Math.max(minWeight, Math.min(maxWeight, raw));
  return Number(clamped.toFixed(2));
}

/**
 * Pure statistical computation for forecasters based on an array of prediction records.
 */
export function computeForecasterStats(records: PredictionRecord[]): ForecasterAnalysis[] {
  // Defensive deduplication guard: ensures clean stats even if dirty data is provided
  const cleanRecords = dedupePredictions(records);

  const map = new Map<
    string,
    {
      handle: string;
      categoryCount: Record<string, number>;
      picks: PredictionRecord[];
      wins: number;
      losses: number;
      pending: number;
      pnl: number;
      deltaTotal: number;
      blobs: Set<string>;
      catStats: Record<string, { total: number; wins: number; losses: number; delta: number }>;
    }
  >();

  for (const r of cleanRecords) {
    if (!r.analyst || r.analyst.startsWith("WalRecall Consensus") || r.analyst.startsWith("AlphaRecall Consensus")) continue;

    const existing = map.get(r.analyst) || {
      handle: r.analyst,
      categoryCount: {},
      picks: [],
      wins: 0,
      losses: 0,
      pending: 0,
      pnl: 0,
      deltaTotal: 0,
      blobs: new Set<string>(),
      catStats: {},
    };

    existing.picks.push(r);
    existing.categoryCount[r.sportType] = (existing.categoryCount[r.sportType] || 0) + 1;

    // Category-specific tracking
    const cat = r.sportType;
    if (!existing.catStats[cat]) {
      existing.catStats[cat] = { total: 0, wins: 0, losses: 0, delta: 0 };
    }
    existing.catStats[cat].total += 1;
    existing.catStats[cat].delta += r.credibilityDelta || 0;

    if (r.outcome === "ACCURATE") {
      existing.wins += 1;
      existing.catStats[cat].wins += 1;
    } else if (r.outcome === "FAILED") {
      existing.losses += 1;
      existing.catStats[cat].losses += 1;
    } else {
      existing.pending += 1;
    }

    existing.pnl += r.pnl || 0;
    existing.deltaTotal += r.credibilityDelta || 0;

    if (r.blobId) {
      existing.blobs.add(r.blobId);
    }

    map.set(r.analyst, existing);
  }

  return Array.from(map.values())
    .map((item) => {
      const resolved = item.wins + item.losses;
      const winRate = resolved > 0 ? Number(((item.wins / resolved) * 100).toFixed(1)) : 0;
      const weightMultiplier = computeWeight(item.deltaTotal);

      // Identify primary category by frequency
      let primaryCategory: PredictionCategory = "soccer";
      let maxCount = -1;
      for (const [cat, count] of Object.entries(item.categoryCount)) {
        if (count > maxCount) {
          maxCount = count;
          primaryCategory = cat as PredictionCategory;
        }
      }

      // Recent 5 resolved outcomes sorted by timestamp descending
      const sortedPicks = [...item.picks].sort((a, b) => b.timestamp - a.timestamp);
      const recent: ("W" | "L")[] = sortedPicks
        .filter((p) => p.outcome !== "PENDING")
        .slice(0, 5)
        .map((p) => (p.outcome === "ACCURATE" ? "W" : "L"));

      // Category breakdown
      const categoryBreakdown: Record<string, ForecasterCategoryStats> = {};
      for (const [catName, c] of Object.entries(item.catStats)) {
        const catResolved = c.wins + c.losses;
        categoryBreakdown[catName] = {
          category: catName as PredictionCategory,
          totalPicks: c.total,
          wins: c.wins,
          losses: c.losses,
          winRate: catResolved > 0 ? Number(((c.wins / catResolved) * 100).toFixed(1)) : 0,
          delta: c.delta,
        };
      }

      return {
        handle: item.handle,
        category: primaryCategory,
        totalPicks: item.picks.length,
        wins: item.wins,
        losses: item.losses,
        pending: item.pending,
        winRate,
        deltaTotal: item.deltaTotal,
        weightMultiplier,
        netPnl: item.pnl,
        recent: recent.length > 0 ? recent : (["W"] as ("W" | "L")[]),
        categoryBreakdown,
        verifiedBlobs: Array.from(item.blobs),
      };
    })
    .sort((a, b) => b.weightMultiplier - a.weightMultiplier);
}

export interface MarketOpinion {
  id?: string;
  analyst: string;
  pick: string; // e.g., "OVER 2.5", "UNDER 2.5"
  confidence?: number; // 1 to 5
}

export interface ConsensusScore {
  pick: string;
  unweightedScore: number;
  weightedScore: number;
  supportingAnalysts: string[];
}

export interface ConsensusResult {
  market: string;
  unweightedPick: string;
  unweightedConfidence: number; // percentage (0 to 100)
  weightedPick: string;
  weightedConfidence: number; // percentage (0 to 100)
  confidenceShift: number; // weighted - unweighted
  pivoted: boolean; // true if memory recalibration shifted the consensus choice
  breakdown: ConsensusScore[];
  boostedSharps: string[];
  dampenedForecasters: string[];
}

/**
 * Computes both Unweighted (1.0x baseline) and Memory-Weighted consensus for market opinions.
 */
export function consensus(
  market: string,
  opinions: MarketOpinion[],
  weightsByAnalyst: Record<string, number> | Map<string, number>
): ConsensusResult {
  if (!opinions || opinions.length === 0) {
    return {
      market,
      unweightedPick: "NONE",
      unweightedConfidence: 0,
      weightedPick: "NONE",
      weightedConfidence: 0,
      confidenceShift: 0,
      pivoted: false,
      breakdown: [],
      boostedSharps: [],
      dampenedForecasters: [],
    };
  }

  const getWeight = (analyst: string): number => {
    if (weightsByAnalyst instanceof Map) {
      return weightsByAnalyst.get(analyst) ?? BASE_CREDIBILITY_WEIGHT;
    }
    return weightsByAnalyst[analyst] ?? BASE_CREDIBILITY_WEIGHT;
  };

  const pickMap = new Map<
    string,
    { unweighted: number; weighted: number; analysts: string[] }
  >();

  let totalUnweighted = 0;
  let totalWeighted = 0;
  const boostedSharps: string[] = [];
  const dampenedForecasters: string[] = [];

  // Deduplicate opinions: allow only one pick per analyst or per id
  const uniqueOpinions: MarketOpinion[] = [];
  const seenAnalysts = new Set<string>();
  const seenIds = new Set<string>();

  for (const op of opinions) {
    if (!op || !op.analyst) continue;
    if (seenAnalysts.has(op.analyst)) continue;
    if (op.id && seenIds.has(op.id)) continue;

    seenAnalysts.add(op.analyst);
    if (op.id) seenIds.add(op.id);
    uniqueOpinions.push(op);
  }

  for (const op of uniqueOpinions) {
    const rawConf = typeof op.confidence === "number" && op.confidence > 0 ? op.confidence : 1.0;
    const w = getWeight(op.analyst);

    if (w > BASE_CREDIBILITY_WEIGHT && !boostedSharps.includes(op.analyst)) {
      boostedSharps.push(op.analyst);
    } else if (w < BASE_CREDIBILITY_WEIGHT && !dampenedForecasters.includes(op.analyst)) {
      dampenedForecasters.push(op.analyst);
    }

    const unweightedScore = rawConf;
    const weightedScore = rawConf * w;

    totalUnweighted += unweightedScore;
    totalWeighted += weightedScore;

    const existing = pickMap.get(op.pick) || {
      unweighted: 0,
      weighted: 0,
      analysts: [],
    };

    existing.unweighted += unweightedScore;
    existing.weighted += weightedScore;
    existing.analysts.push(op.analyst);
    pickMap.set(op.pick, existing);
  }

  const breakdown: ConsensusScore[] = Array.from(pickMap.entries()).map(([pick, data]) => ({
    pick,
    unweightedScore: Number(data.unweighted.toFixed(2)),
    weightedScore: Number(data.weighted.toFixed(2)),
    supportingAnalysts: data.analysts,
  }));

  // Determine winners
  let unweightedWinner = breakdown[0]?.pick || "NONE";
  let maxUnweighted = breakdown[0]?.unweightedScore || 0;

  let weightedWinner = breakdown[0]?.pick || "NONE";
  let maxWeighted = breakdown[0]?.weightedScore || 0;

  for (const b of breakdown) {
    if (b.unweightedScore > maxUnweighted) {
      maxUnweighted = b.unweightedScore;
      unweightedWinner = b.pick;
    }
    if (b.weightedScore > maxWeighted) {
      maxWeighted = b.weightedScore;
      weightedWinner = b.pick;
    }
  }

  const unweightedConf =
    totalUnweighted > 0 ? Number(((maxUnweighted / totalUnweighted) * 100).toFixed(1)) : 0;
  const weightedConf =
    totalWeighted > 0 ? Number(((maxWeighted / totalWeighted) * 100).toFixed(1)) : 0;

  return {
    market,
    unweightedPick: unweightedWinner,
    unweightedConfidence: unweightedConf,
    weightedPick: weightedWinner,
    weightedConfidence: weightedConf,
    confidenceShift: Number((weightedConf - unweightedConf).toFixed(1)),
    pivoted: unweightedWinner !== weightedWinner,
    breakdown,
    boostedSharps,
    dampenedForecasters,
  };
}
