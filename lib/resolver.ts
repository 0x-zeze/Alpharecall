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
 * Maximum elapsed time after a forecast deadline during which spot price settlement is permitted.
 * If settlement is triggered after this window, the forecast is marked 'expired-unresolved'
 * and no resolution memory is written, preventing stale spot prices from contaminating scores.
 */
export const RESOLVER_GRACE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Maximum number of due predictions resolved per execution call.
 * Bounds serverless function execution time on platforms like Vercel.
 */
export const MAX_RESOLUTIONS_PER_BATCH = 5;

/**
 * Maximum allowed prediction horizon from creation time (30 days).
 */
export const MAX_PREDICTION_HORIZON_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  oracleFallbackUsed?: boolean;
}

export interface ResolutionResult {
  predictionId: string;
  analyst: string;
  target: string;
  pick: string;
  status:
    | "resolved"
    | "not_due"
    | "expired-unresolved"
    | "legacy-no-deadline"
    | "skipped"
    | "failed"
    | "manual_required"
    | "batch_deferred";
  outcome?: PredictionStatus;
  delta?: number;
  reason?: string;
  evidence?: ResolutionEvidence;
  blobId?: string;
  oracleFallbackUsed?: boolean;
}

/**
 * Parses crypto price target and direction from record or pick/content strings.
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
 * Resolves a single crypto prediction via Tatum Data API (or guarded fallback oracle).
 * Enforces deadline check, grace window check, and honest evidence recording.
 */
export async function resolveCryptoPrediction(
  record: PredictionRecord,
  now = Date.now()
): Promise<ResolutionResult> {
  // 1. Check Deadline Requirement
  if (!record.deadline) {
    return {
      predictionId: record.id,
      analyst: record.analyst,
      target: record.target,
      pick: record.pick,
      status: "legacy-no-deadline",
      reason: "legacy-no-deadline: historical prediction has no deadline. Deferred to manual or backtest audit.",
    };
  }

  const deadlineMs = Date.parse(record.deadline);
  if (isNaN(deadlineMs)) {
    return {
      predictionId: record.id,
      analyst: record.analyst,
      target: record.target,
      pick: record.pick,
      status: "failed",
      reason: `Malformed deadline string: '${record.deadline}'`,
    };
  }

  // 2. Check if deadline is in the future
  if (now < deadlineMs) {
    const diffMs = deadlineMs - now;
    const remainingMins = Math.max(1, Math.round(diffMs / 60000));
    const remainingHours = (diffMs / 3600000).toFixed(1);
    return {
      predictionId: record.id,
      analyst: record.analyst,
      target: record.target,
      pick: record.pick,
      status: "not_due",
      reason: `Prediction is not due yet. Deadline: ${record.deadline} (~${remainingHours}h / ${remainingMins}m remaining).`,
    };
  }

  // 3. Check Grace Window
  const elapsedSinceDeadlineMs = now - deadlineMs;
  if (elapsedSinceDeadlineMs > RESOLVER_GRACE_WINDOW_MS) {
    const elapsedHours = (elapsedSinceDeadlineMs / 3600000).toFixed(1);
    return {
      predictionId: record.id,
      analyst: record.analyst,
      target: record.target,
      pick: record.pick,
      status: "expired-unresolved",
      reason: `Settlement grace window exceeded. Deadline was ${record.deadline} (${elapsedHours}h ago, limit is ${RESOLVER_GRACE_WINDOW_MS / 3600000}h). Left unresolved to preserve credibility integrity.`,
    };
  }

  // 4. Parse Asset and Target Price
  let symbol: "sui" | "bitcoin" | "ethereum" = "sui";
  let targetPrice = record.targetPrice || 0;
  let direction: "above" | "below" = record.direction || "above";

  if (record.asset) {
    const a = record.asset.toLowerCase();
    if (a.includes("btc") || a.includes("bitcoin")) symbol = "bitcoin";
    else if (a.includes("eth") || a.includes("ethereum")) symbol = "ethereum";
    else symbol = "sui";
  }

  if (targetPrice <= 0) {
    const parsed = parseCryptoTarget(record.target, record.pick);
    if (!parsed) {
      return {
        predictionId: record.id,
        analyst: record.analyst,
        target: record.target,
        pick: record.pick,
        status: "failed",
        reason: "Could not parse numeric price target and direction from prediction text.",
      };
    }
    symbol = parsed.symbol;
    targetPrice = parsed.targetPrice;
    direction = parsed.direction;
  }

  const fetchedAt = new Date(now).toISOString();

  // 5. Fetch Price: Primary = Tatum Data API
  let price: number | undefined;
  let source = "tatum_data_api";
  let method = "tatum_spot_within_grace";
  let oracleFallbackUsed = false;

  const tatumRate = await getTatumCryptoRate(symbol.toUpperCase(), "USD");
  if (tatumRate.ok && typeof tatumRate.rate === "number") {
    price = tatumRate.rate;
    source = tatumRate.source || "tatum_data_api";
  } else {
    // Check if public fallback is explicitly permitted via env
    const allowPublicFallback = process.env.ALLOW_PUBLIC_ORACLE_FALLBACK === "true";

    if (!allowPublicFallback) {
      return {
        predictionId: record.id,
        analyst: record.analyst,
        target: record.target,
        pick: record.pick,
        status: "failed",
        reason: `Tatum Data API unavailable (${tatumRate.error || "error"}) and public oracle fallback is disabled (ALLOW_PUBLIC_ORACLE_FALLBACK is false). Resolution deferred.`,
      };
    }

    // Public fallback (CoinGecko)
    const fallback = await getFallbackCryptoRate(symbol);
    if (fallback.ok && typeof fallback.rate === "number") {
      price = fallback.rate;
      source = fallback.source || "coingecko_public_fallback";
      method = "public_oracle_fallback_within_grace";
      oracleFallbackUsed = true;
    } else {
      return {
        predictionId: record.id,
        analyst: record.analyst,
        target: record.target,
        pick: record.pick,
        status: "failed",
        reason: `Both Tatum Data API and public fallback oracle failed: ${tatumRate.error || ""} | ${fallback.error || ""}`,
      };
    }
  }

  // 6. Evaluate Outcome
  const conditionMet = direction === "above" ? price >= targetPrice : price <= targetPrice;
  const outcome: PredictionStatus = conditionMet ? "ACCURATE" : "FAILED";
  const delta = calculateOutcomeDelta(outcome, record.confidence || 4);

  const evidence: ResolutionEvidence = {
    source,
    method,
    price,
    targetPrice,
    fetchedAt,
    oracleFallbackUsed,
    details: `${symbol.toUpperCase()} resolved at $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (Target: ${direction} $${targetPrice.toLocaleString()}) via ${source} [${method}]`,
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
    oracleFallbackUsed,
  };
}

/**
 * Resolves all due predictions.
 * IDEMPOTENT: Never writes the same resolution twice to Walrus.
 * BATCH-BOUND: Resolves up to MAX_RESOLUTIONS_PER_BATCH (5) per invocation to fit serverless timeouts.
 * Sports predictions are flagged as "manual_required" (no fake Tatum claims).
 */
export async function resolveDuePredictions(
  candidatePredictions: PredictionRecord[],
  now = Date.now()
): Promise<{
  success: boolean;
  totalEvaluated: number;
  resolvedCount: number;
  skippedCount: number;
  batchDeferredCount: number;
  results: ResolutionResult[];
}> {
  // 1. Fetch current memories from Walrus to enforce idempotency
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
  let batchDeferredCount = 0;

  for (const pred of candidatePredictions) {
    // A. Idempotency Check: if already resolved, skip!
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

    // B. Non-Crypto Predictions: manual resolution required
    if (pred.sportType !== "crypto") {
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
          fetchedAt: new Date(now).toISOString(),
          details: "Pending manual or external sports feed confirmation (e.g. ESPN).",
        },
      });
      continue;
    }

    // C. Batch Concurrency Guard
    if (resolvedCount >= MAX_RESOLUTIONS_PER_BATCH) {
      batchDeferredCount++;
      results.push({
        predictionId: pred.id,
        analyst: pred.analyst,
        target: pred.target,
        pick: pred.pick,
        status: "batch_deferred",
        reason: `Batch limit reached (max ${MAX_RESOLUTIONS_PER_BATCH} resolutions per run). Deferred to next tick.`,
      });
      continue;
    }

    // D. Resolve Crypto Prediction
    const resolution = await resolveCryptoPrediction(pred, now);

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
        timestamp: now,
        dateStr: new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        reasoning: pred.reasoning,
        postMortem: resolution.evidence?.details,
        deadline: pred.deadline,
        direction: pred.direction,
        targetPrice: pred.targetPrice,
        asset: pred.asset,
        oracleFallbackUsed: resolution.oracleFallbackUsed,
      };

      const saved = await saveMemory(resolvedRecord);
      resolution.blobId = saved.blobId;
      alreadyResolvedIds.add(pred.id);
      resolvedCount++;
    }

    results.push(resolution);
  }

  return {
    success: true,
    totalEvaluated: candidatePredictions.length,
    resolvedCount,
    skippedCount,
    batchDeferredCount,
    results,
  };
}
