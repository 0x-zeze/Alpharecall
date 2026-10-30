import type { PredictionRecord, PredictionStatus } from "./types";
import { getTatumCryptoRate, getFallbackCryptoRate } from "./tatum";
import { saveMemory, getAllMemories } from "./walrus";

export const RESOLUTION_RULES = {
  WIN_HIGH_CONFIDENCE_DELTA: 8,
  WIN_STANDARD_DELTA: 6,
  WIN_LOW_CONFIDENCE_DELTA: 4,
  LOSS_STANDARD_DELTA: -5,
  LOSS_HIGH_CONFIDENCE_DELTA: -8,
} as const;

/**
 * Calculates explicit credibility score delta based on outcome and forecaster confidence.
 */
export function calculateOutcomeDelta(outcome: PredictionStatus, confidence = 4): number {
  if (outcome === "ACCURATE") {
    if (confidence >= 5) return RESOLUTION_RULES.WIN_HIGH_CONFIDENCE_DELTA;
    if (confidence <= 2) return RESOLUTION_RULES.WIN_LOW_CONFIDENCE_DELTA;
    return RESOLUTION_RULES.WIN_STANDARD_DELTA;
  }
  if (outcome === "FAILED") {
    if (confidence >= 5) return RESOLUTION_RULES.LOSS_HIGH_CONFIDENCE_DELTA;
    return RESOLUTION_RULES.LOSS_STANDARD_DELTA;
  }
  return 0;
}

export interface ResolutionEvidence {
  source: string;
  method: string;
  price?: number;
  targetPrice?: number;
  fetchedAt: string;
  details?: string;
}

export interface ResolutionResult {
  predictionId: string;
  analyst: string;
  target: string;
  pick: string;
  status: "resolved" | "skipped" | "failed" | "manual_required";
  outcome?: PredictionStatus;
  delta?: number;
  reason?: string;
  evidence?: ResolutionEvidence;
  blobId?: string;
}

/**
 * Parses crypto price target and direction from pick / content strings.
 * Example: "LONG SUI > $2.00", "BOUNCE > $1.85", "BTC TEST $69K", "RATIO < 0.0380"
 */
export function parseCryptoTarget(
  targetStr: string,
  pickStr: string
): { symbol: "sui" | "bitcoin" | "ethereum"; targetPrice: number; direction: "above" | "below" } | null {
  const combined = `${targetStr} ${pickStr}`.toLowerCase();

  let symbol: "sui" | "bitcoin" | "ethereum" = "sui";
  if (combined.includes("sui")) {
    symbol = "sui";
  } else if (combined.includes("eth") || combined.includes("ethereum")) {
    symbol = "ethereum";
  } else if (combined.includes("btc") || combined.includes("bitcoin")) {
    symbol = "bitcoin";
  }

  // Find price pattern: > $1.85, > $2.00, $69,000, 69k
  let targetPrice = 0;
  let direction: "above" | "below" = "above";

  if (combined.includes("<") || combined.includes("under") || combined.includes("short")) {
    direction = "below";
  }

  const kMatch = combined.match(/(\d+(?:\.\d+)?)\s*k/);
  if (kMatch) {
    targetPrice = parseFloat(kMatch[1]) * 1000;
  } else {
    const numMatch = combined.match(/(?:>|<|\$)\s*(\d+(?:\.\d+)?)/);
    if (numMatch) {
      targetPrice = parseFloat(numMatch[1]);
    }
  }

  if (targetPrice <= 0) return null;

  return { symbol, targetPrice, direction };
}

/**
 * Resolves a single crypto prediction via Tatum Data API (or fallback oracle).
 */
export async function resolveCryptoPrediction(
  record: PredictionRecord
): Promise<ResolutionResult> {
  const parsed = parseCryptoTarget(record.target, record.pick);

  if (!parsed) {
    return {
      predictionId: record.id,
      analyst: record.analyst,
      target: record.target,
      pick: record.pick,
      status: "failed",
      reason: "Could not parse numeric price target from prediction.",
    };
  }

  const { symbol, targetPrice, direction } = parsed;
  const fetchedAt = new Date().toISOString();

  // Try Tatum Data API first with x-api-key
  let price: number | undefined;
  let source = "tatum_data_api";
  let method = "tatum_spot_rate_at_settlement";

  const tatumRate = await getTatumCryptoRate(symbol.toUpperCase(), "USD");
  if (tatumRate.ok && typeof tatumRate.rate === "number") {
    price = tatumRate.rate;
    source = tatumRate.source || "tatum_data_api";
  } else {
    // If Tatum API key is not configured, fall back to public oracle
    const fallback = await getFallbackCryptoRate(symbol);
    if (fallback.ok && typeof fallback.rate === "number") {
      price = fallback.rate;
      source = fallback.source || "coingecko_public_fallback";
      method = "spot_at_settlement_public_oracle";
    } else {
      return {
        predictionId: record.id,
        analyst: record.analyst,
        target: record.target,
        pick: record.pick,
        status: "failed",
        reason: `Both Tatum Data API and fallback oracle failed: ${tatumRate.error || ""} | ${fallback.error || ""}`,
      };
    }
  }

  // Determine outcome
  const conditionMet = direction === "above" ? price >= targetPrice : price <= targetPrice;
  const outcome: PredictionStatus = conditionMet ? "ACCURATE" : "FAILED";
  const delta = calculateOutcomeDelta(outcome, record.confidence || 4);

  const evidence: ResolutionEvidence = {
    source,
    method,
    price,
    targetPrice,
    fetchedAt,
    details: `${symbol.toUpperCase()} resolved at $${price.toLocaleString()} (Target: ${direction} $${targetPrice.toLocaleString()}) via ${source}`,
  };

  return {
    predictionId: record.id,
    analyst: record.analyst,
    target: record.target,
    pick: record.pick,
    status: "resolved",
    outcome,
    delta,
    evidence,
  };
}

/**
 * Resolves all due predictions.
 * IDEMPOTENT: Never writes the same resolution twice to Walrus.
 * Sports predictions are flagged as "manual_required" (no fake Tatum claim).
 */
export async function resolveDuePredictions(
  candidatePredictions: PredictionRecord[]
): Promise<{
  success: boolean;
  totalEvaluated: number;
  resolvedCount: number;
  skippedCount: number;
  results: ResolutionResult[];
}> {
  // 1. Fetch current memories from Walrus to verify idempotency
  const existingMemories = await getAllMemories();
  const alreadyResolvedIds = new Set<string>();

  for (const m of existingMemories) {
    if (m.outcome === "ACCURATE" || m.outcome === "FAILED") {
      alreadyResolvedIds.add(m.id);
    }
  }

  const results: ResolutionResult[] = [];
  let resolvedCount = 0;
  let skippedCount = 0;

  for (const pred of candidatePredictions) {
    // Check idempotency: if already resolved, skip!
    if (alreadyResolvedIds.has(pred.id)) {
      skippedCount++;
      results.push({
        predictionId: pred.id,
        analyst: pred.analyst,
        target: pred.target,
        pick: pred.pick,
        status: "skipped",
        reason: "Already resolved in Walrus Memory (idempotent skip).",
      });
      continue;
    }

    // If prediction is not due yet and still pending, check category
    if (pred.sportType === "crypto") {
      const resolution = await resolveCryptoPrediction(pred);

      if (resolution.status === "resolved" && resolution.outcome && typeof resolution.delta === "number") {
        // Commit structured resolution memory to Walrus!
        const resolvedRecord: Partial<PredictionRecord> & {
          title: string;
          content: string;
          analyst: string;
          target: string;
          pick: string;
          outcome: PredictionStatus;
          credibilityDelta: number;
        } = {
          id: pred.id,
          category: "audit",
          sportType: "crypto",
          leagueOrAsset: pred.leagueOrAsset,
          title: `Resolution: ${pred.title}`,
          content: resolution.evidence?.details || `${pred.target}: ${pred.pick} -> ${resolution.outcome}`,
          analyst: pred.analyst,
          target: pred.target,
          pick: pred.pick,
          odds: pred.odds,
          stake: pred.stake,
          pnl: resolution.outcome === "ACCURATE" ? Math.round(pred.stake * 0.9) : -pred.stake,
          outcome: resolution.outcome,
          credibilityDelta: resolution.delta,
          confidence: pred.confidence,
          timestamp: Date.now(),
          dateStr: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          reasoning: pred.reasoning,
          postMortem: resolution.evidence?.details,
        };

        const saved = await saveMemory(resolvedRecord);
        resolution.blobId = saved.blobId;
        alreadyResolvedIds.add(pred.id);
        resolvedCount++;
      }

      results.push(resolution);
    } else {
      // Sports (Soccer / NBA) predictions have no automated on-chain oracle
      // Per rule: Mark as manual resolution required, NEVER claim Tatum verified!
      results.push({
        predictionId: pred.id,
        analyst: pred.analyst,
        target: pred.target,
        pick: pred.pick,
        status: "manual_required",
        reason: "Sports fixtures (Soccer/NBA) require official match settlement. Not claimable via Tatum.",
        evidence: {
          source: "manual_sports_settlement",
          method: "official_match_scorecard",
          fetchedAt: new Date().toISOString(),
          details: "Pending manual or external sports feed confirmation (e.g. ESPN).",
        },
      });
    }
  }

  return {
    success: true,
    totalEvaluated: candidatePredictions.length,
    resolvedCount,
    skippedCount,
    results,
  };
}
