import { MemWal } from "@mysten-incubation/memwal";
import type { PredictionRecord } from "./types";
import { DEMO_PREDICTIONS } from "./demo-data";
import { dedupePredictions } from "./dedupe";
import {
  encodeMemory,
  decodeMemory,
  payloadToPredictionRecord,
  predictionRecordToPayload,
} from "./memory-codec";

export type MemoryRecord = PredictionRecord;

// Transient in-memory cache for demo/offline fallback.
// In production with Walrus keys configured, the source of truth is Walrus via recall().
const localDemoCache: MemoryRecord[] = [...DEMO_PREDICTIONS];

export function getMemWalClient(): MemWal | null {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
  const namespace = process.env.MEMWAL_NAMESPACE || "alpharecall";

  if (!key || !accountId) {
    return null;
  }

  try {
    return MemWal.create({
      key,
      accountId,
      serverUrl,
      namespace,
    });
  } catch (err) {
    console.warn("Failed to initialize MemWal client:", err);
    return null;
  }
}

/**
 * Checks authentic Walrus Mainnet connectivity.
 * Returns true ONLY if keys are configured AND the live relayer/recall call succeeds.
 */
export async function checkWalrusConnection(): Promise<{
  isMainnetConnected: boolean;
  mode: "live" | "demo";
  error?: string;
}> {
  const client = getMemWalClient();
  if (!client) {
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: "MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID not configured.",
    };
  }

  try {
    const health = await client.health();
    if (health?.status === "ok" || health?.write_ready) {
      return {
        isMainnetConnected: true,
        mode: "live",
      };
    }
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: "Walrus relayer write_ready is false.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: `Walrus relayer unreachable: ${errorMsg}`,
    };
  }
}

/**
 * Retrieve all memories from Walrus Memory on Mainnet via recall().
 * Executes semantic recall, filters and validates via decodeMemory(),
 * drops invalid or non-prefixed items, and sorts by timestamp descending.
 * Falls back to canonical demo data ONLY if Walrus keys are missing or recall fails.
 */
export async function getAllMemories(): Promise<MemoryRecord[]> {
  const client = getMemWalClient();
  if (!client) {
    return dedupePredictions(localDemoCache);
  }

  try {
    // Multi-query recall to maximize retrieval coverage from Walrus
    const [recallRes1, recallRes2] = await Promise.all([
      client.recall({ query: "ALPHARECALL_V1 resolution prediction", limit: 30 }),
      client.recall({ query: "credibility audit sports crypto", limit: 20 }),
    ]);

    const combinedHits = [
      ...(recallRes1?.results || []),
      ...(recallRes2?.results || []),
    ];

    // Deduplicate hits by blob_id
    const seenBlobs = new Set<string>();
    const validRecords: MemoryRecord[] = [];

    for (const item of combinedHits) {
      if (!item.blob_id || seenBlobs.has(item.blob_id)) continue;
      seenBlobs.add(item.blob_id);

      // Strictly validate schema via decodeMemory()
      const decoded = decodeMemory(item.text);
      if (!decoded) {
        // Discard invalid, malformed, or un-prefixed memories
        continue;
      }

      const record = payloadToPredictionRecord(decoded, item.blob_id);
      validRecords.push(record);
    }

    if (validRecords.length > 0) {
      // Sort chronologically newest first and deduplicate by prediction id
      validRecords.sort((a, b) => b.timestamp - a.timestamp);
      return dedupePredictions(validRecords);
    }

    // If no valid Walrus memories were recalled yet, return local demo data
    return dedupePredictions(localDemoCache);
  } catch (error) {
    console.warn("Falling back to local demo data after Walrus recall failure:", error);
    return dedupePredictions(localDemoCache);
  }
}

/**
 * Commit a new prediction or audit record to Walrus Memory.
 * - Encodes using strict ALPHARECALL_V1 prefix and schema validator.
 * - If client is configured: submits remember(), waits for job, and records real blobId + writeStatus: "confirmed".
 * - If client is missing: writeStatus: "local-demo" without blobId.
 * - If remember fails: writeStatus: "failed" with explicit writeError.
 */
export async function saveMemory(record: Partial<MemoryRecord> & {
  title: string;
  content: string;
  analyst: string;
  target: string;
  pick: string;
  outcome: "PENDING" | "ACCURATE" | "FAILED";
  credibilityDelta: number;
}): Promise<MemoryRecord> {
  const newRecord: MemoryRecord = {
    id: record.id || `rec-${Date.now()}`,
    category: record.category || "prediction",
    sportType: record.sportType || "soccer",
    leagueOrAsset: record.leagueOrAsset,
    title: record.title,
    content: record.content,
    analyst: record.analyst,
    target: record.target,
    pick: record.pick,
    odds: record.odds || "-110",
    stake: record.stake ?? 250,
    pnl: record.pnl ?? 0,
    outcome: record.outcome,
    credibilityDelta: record.credibilityDelta,
    confidence: record.confidence ?? 4,
    timestamp: record.timestamp || Date.now(),
    dateStr: record.dateStr || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    reasoning: record.reasoning,
    postMortem: record.postMortem,
    tags: record.tags,
    deadline: record.deadline,
    direction: record.direction,
    targetPrice: record.targetPrice,
    asset: record.asset,
    suiCheckpoint: record.suiCheckpoint,
    suiCheckpointDigest: record.suiCheckpointDigest,
    suiCheckpointSource: record.suiCheckpointSource,
    blobId: undefined,
    writeStatus: "pending",
    source: "demo",
  };

  const client = getMemWalClient();
  if (!client) {
    newRecord.writeStatus = "local-demo";
    newRecord.blobId = undefined;
    localDemoCache.unshift(newRecord);
    return newRecord;
  }

  try {
    // Encode via strictly validated memory codec
    const payload = predictionRecordToPayload(newRecord);
    const memoryString = encodeMemory(payload);

    const accepted = await client.remember(memoryString);
    if (!accepted?.job_id) {
      newRecord.writeStatus = "failed";
      newRecord.writeError = "Walrus relayer did not return an accepted job_id";
      localDemoCache.unshift(newRecord);
      return newRecord;
    }

    // Wait for terminal state to extract the authentic Walrus blob_id
    const rememberResult = await client.waitForRememberJob(accepted.job_id);
    if (rememberResult?.blob_id) {
      newRecord.blobId = rememberResult.blob_id;
      newRecord.writeStatus = "confirmed";
      newRecord.source = "walrus";
    } else {
      newRecord.writeStatus = "failed";
      newRecord.writeError = "Remember job finished without valid blob_id";
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("Walrus remember operation failed:", errorMsg);
    newRecord.writeStatus = "failed";
    newRecord.writeError = errorMsg;
  }

  localDemoCache.unshift(newRecord);
  return newRecord;
}
