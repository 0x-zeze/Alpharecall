import type { PredictionRecord, PredictionCategory, PredictionStatus } from "./types";

export const MEMORY_PREFIX = "ALPHARECALL_V1 ";

export interface MemoryEvidence {
  score?: string;
  finalEvent?: string;
  details?: string;
  onchainMetrics?: string;
  source?: string;
  method?: string;
  price?: number;
  targetPrice?: number;
  fetchedAt?: string;
  [key: string]: unknown;
}

export interface MemoryPayloadV1 {
  version: "1.0";
  type: "resolution" | "prediction";
  predictionId: string;
  analyst: string;
  category: PredictionCategory;
  leagueOrAsset?: string;
  title: string;
  target: string;
  pick: string;
  odds?: string;
  stake?: number;
  pnl?: number;
  outcome: PredictionStatus;
  delta: number;
  confidence?: number;
  resolvedAt: string; // ISO-8601 string
  reasoning?: string;
  postMortem?: string;
  tags?: string[];
  evidence?: MemoryEvidence;

  // BAGIAN 2: Optional Forecast Target & Deadline fields
  deadline?: string; // ISO-8601 string, e.g. "2026-11-01T00:00:00.000Z"
  direction?: "above" | "below";
  targetPrice?: number;
  asset?: string; // e.g. "SUI", "BTC", "ETH"

  // BAGIAN 3: Optional Sui Anchor fields
  suiCheckpoint?: string | null;
  suiCheckpointDigest?: string | null;
}

/**
 * Validates and encodes a structured prediction memory payload into a single prefixed string.
 */
export function encodeMemory(payload: MemoryPayloadV1): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload: must be a non-null object.");
  }
  if (!payload.predictionId || typeof payload.predictionId !== "string") {
    throw new Error("Invalid payload: predictionId is required and must be a string.");
  }
  if (!payload.analyst || typeof payload.analyst !== "string") {
    throw new Error("Invalid payload: analyst is required.");
  }
  if (!payload.pick || typeof payload.pick !== "string") {
    throw new Error("Invalid payload: pick is required.");
  }
  if (!["ACCURATE", "FAILED", "PENDING"].includes(payload.outcome)) {
    throw new Error(`Invalid payload: outcome '${payload.outcome}' is not supported.`);
  }

  const normalized: MemoryPayloadV1 = {
    version: "1.0",
    type: payload.type || "resolution",
    predictionId: payload.predictionId.trim(),
    analyst: payload.analyst.trim(),
    category: payload.category || "soccer",
    leagueOrAsset: payload.leagueOrAsset,
    title: payload.title || payload.target,
    target: payload.target.trim(),
    pick: payload.pick.trim(),
    odds: payload.odds || "-110",
    stake: typeof payload.stake === "number" ? payload.stake : 250,
    pnl: typeof payload.pnl === "number" ? payload.pnl : 0,
    outcome: payload.outcome,
    delta: typeof payload.delta === "number" ? payload.delta : 0,
    confidence: typeof payload.confidence === "number" ? payload.confidence : 4,
    resolvedAt: payload.resolvedAt || new Date().toISOString(),
    reasoning: payload.reasoning,
    postMortem: payload.postMortem,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    evidence: payload.evidence,
    deadline: payload.deadline,
    direction: payload.direction,
    targetPrice: payload.targetPrice,
    asset: payload.asset,
    suiCheckpoint: payload.suiCheckpoint,
    suiCheckpointDigest: payload.suiCheckpointDigest,
  };

  return `${MEMORY_PREFIX}${JSON.stringify(normalized)}`;
}

/**
 * Parses and strictly validates a raw Walrus memory string.
 * Rejects and returns null if the string lacks the prefix, is malformed JSON,
 * or fails schema type and invariant checks.
 * Backward compatible: accepts all legacy v1 memories without optional fields.
 */
export function decodeMemory(rawText: string | null | undefined): MemoryPayloadV1 | null {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  const trimmed = rawText.trim();
  if (!trimmed.startsWith(MEMORY_PREFIX)) {
    return null;
  }

  const jsonStr = trimmed.slice(MEMORY_PREFIX.length).trim();
  if (!jsonStr) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Strict Schema Invariant Validation
  if (typeof obj.predictionId !== "string" || !obj.predictionId.trim()) return null;
  if (typeof obj.analyst !== "string" || !obj.analyst.trim()) return null;
  if (typeof obj.target !== "string" || !obj.target.trim()) return null;
  if (typeof obj.pick !== "string" || !obj.pick.trim()) return null;
  if (typeof obj.delta !== "number" || isNaN(obj.delta)) return null;

  const validOutcomes: PredictionStatus[] = ["ACCURATE", "FAILED", "PENDING"];
  if (typeof obj.outcome !== "string" || !validOutcomes.includes(obj.outcome as PredictionStatus)) {
    return null;
  }

  const validCategories: PredictionCategory[] = ["soccer", "nba", "crypto", "sports"];
  const category: PredictionCategory =
    typeof obj.category === "string" && validCategories.includes(obj.category as PredictionCategory)
      ? (obj.category as PredictionCategory)
      : "soccer";

  // Validate date
  let resolvedAtStr = typeof obj.resolvedAt === "string" ? obj.resolvedAt : "";
  if (!resolvedAtStr || isNaN(Date.parse(resolvedAtStr))) {
    resolvedAtStr = new Date().toISOString();
  }

  // Optional extensions (safe and backward-compatible)
  const deadline = typeof obj.deadline === "string" ? obj.deadline : undefined;
  const direction = obj.direction === "above" || obj.direction === "below" ? obj.direction : undefined;
  const targetPrice = typeof obj.targetPrice === "number" && !isNaN(obj.targetPrice) ? obj.targetPrice : undefined;
  const asset = typeof obj.asset === "string" ? obj.asset : undefined;
  const suiCheckpoint = typeof obj.suiCheckpoint === "string" ? obj.suiCheckpoint : null;
  const suiCheckpointDigest = typeof obj.suiCheckpointDigest === "string" ? obj.suiCheckpointDigest : null;

  return {
    version: "1.0",
    type: obj.type === "prediction" ? "prediction" : "resolution",
    predictionId: obj.predictionId.trim(),
    analyst: obj.analyst.trim(),
    category,
    leagueOrAsset: typeof obj.leagueOrAsset === "string" ? obj.leagueOrAsset : undefined,
    title: typeof obj.title === "string" ? obj.title : String(obj.target),
    target: obj.target.trim(),
    pick: obj.pick.trim(),
    odds: typeof obj.odds === "string" ? obj.odds : "-110",
    stake: typeof obj.stake === "number" ? obj.stake : 250,
    pnl: typeof obj.pnl === "number" ? obj.pnl : 0,
    outcome: obj.outcome as PredictionStatus,
    delta: obj.delta,
    confidence: typeof obj.confidence === "number" ? obj.confidence : 4,
    resolvedAt: resolvedAtStr,
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning : undefined,
    postMortem: typeof obj.postMortem === "string" ? obj.postMortem : undefined,
    tags: Array.isArray(obj.tags) ? (obj.tags.filter((t) => typeof t === "string") as string[]) : [],
    evidence: typeof obj.evidence === "object" && obj.evidence !== null ? (obj.evidence as MemoryEvidence) : undefined,
    deadline,
    direction,
    targetPrice,
    asset,
    suiCheckpoint,
    suiCheckpointDigest,
  };
}

/**
 * Transforms a decoded MemoryPayloadV1 into an application PredictionRecord.
 */
export function payloadToPredictionRecord(
  payload: MemoryPayloadV1,
  blobId?: string
): PredictionRecord {
  const timestamp = Date.parse(payload.resolvedAt) || Date.now();
  const dateStr = new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    id: payload.predictionId,
    category: "audit",
    sportType: payload.category,
    leagueOrAsset: payload.leagueOrAsset,
    title: payload.title,
    content: `${payload.target}: ${payload.pick} (${payload.outcome})`,
    analyst: payload.analyst,
    target: payload.target,
    pick: payload.pick,
    odds: payload.odds || "-110",
    stake: payload.stake ?? 250,
    pnl: payload.pnl ?? 0,
    outcome: payload.outcome,
    credibilityDelta: payload.delta,
    confidence: payload.confidence ?? 4,
    timestamp,
    dateStr,
    blobId,
    writeStatus: blobId ? "confirmed" : "local-demo",
    source: blobId ? "walrus" : "demo",
    reasoning: payload.reasoning,
    postMortem: payload.postMortem,
    tags: payload.tags,
    deadline: payload.deadline,
    direction: payload.direction,
    targetPrice: payload.targetPrice,
    asset: payload.asset,
    suiCheckpoint: payload.suiCheckpoint,
    suiCheckpointDigest: payload.suiCheckpointDigest,
  };
}

/**
 * Transforms an application PredictionRecord into a MemoryPayloadV1 for Walrus.
 */
export function predictionRecordToPayload(record: PredictionRecord): MemoryPayloadV1 {
  return {
    version: "1.0",
    type: record.outcome === "PENDING" ? "prediction" : "resolution",
    predictionId: record.id,
    analyst: record.analyst,
    category: record.sportType,
    leagueOrAsset: record.leagueOrAsset,
    title: record.title,
    target: record.target,
    pick: record.pick,
    odds: record.odds,
    stake: record.stake,
    pnl: record.pnl,
    outcome: record.outcome,
    delta: record.credibilityDelta,
    confidence: record.confidence,
    resolvedAt: new Date(record.timestamp).toISOString(),
    reasoning: record.reasoning,
    postMortem: record.postMortem,
    tags: record.tags,
    evidence: {
      details: record.content,
    },
    deadline: record.deadline,
    direction: record.direction,
    targetPrice: record.targetPrice,
    asset: record.asset,
    suiCheckpoint: record.suiCheckpoint,
    suiCheckpointDigest: record.suiCheckpointDigest,
  };
}
