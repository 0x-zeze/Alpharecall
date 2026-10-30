import { MemWal } from "@mysten-incubation/memwal";
import { PredictionRecord } from "./types";
import { DEMO_PREDICTIONS } from "./demo-data";

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
    // Health probe to verify actual live connection to Walrus Relayer
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
 * Reconstructs prediction records from recalled structured JSON.
 * Falls back to canonical demo data ONLY if Walrus keys are missing or recall fails.
 */
export async function getAllMemories(): Promise<MemoryRecord[]> {
  const client = getMemWalClient();
  if (!client) {
    return localDemoCache;
  }

  try {
    const response = await client.recall({ query: "prediction and credibility audit" });
    if (response?.results && response.results.length > 0) {
      const recalled: MemoryRecord[] = response.results.map((item, idx) => {
        let parsed: Partial<MemoryRecord> = {};
        try {
          parsed = JSON.parse(item.text);
        } catch {
          parsed = {
            title: item.text.slice(0, 60),
            content: item.text,
          };
        }

        return {
          id: parsed.id || `walrus-${idx + 1}`,
          category: parsed.category || "audit",
          sportType: parsed.sportType || "soccer",
          leagueOrAsset: parsed.leagueOrAsset || "UCL",
          title: parsed.title || `Walrus Memory #${idx + 1}`,
          content: parsed.content || item.text,
          analyst: parsed.analyst || "@WalrusSharps",
          target: parsed.target || "Market Fixture",
          pick: parsed.pick || "AUDIT",
          odds: parsed.odds || "-110",
          stake: parsed.stake ?? 250,
          pnl: parsed.pnl ?? 0,
          outcome: parsed.outcome || "ACCURATE",
          credibilityDelta: parsed.credibilityDelta ?? 0,
          confidence: parsed.confidence ?? 4,
          timestamp: parsed.timestamp || (item.created_at ? new Date(item.created_at).getTime() : Date.now()),
          dateStr: parsed.dateStr || (item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today"),
          blobId: item.blob_id, // Real authentic Walrus blob_id
          writeStatus: "confirmed",
          source: "walrus",
          reasoning: parsed.reasoning,
          postMortem: parsed.postMortem,
          tags: parsed.tags,
        };
      });

      return recalled;
    }
    return localDemoCache;
  } catch (error) {
    console.warn("Falling back to local demo data after Walrus recall failure:", error);
    return localDemoCache;
  }
}

/**
 * Commit a new prediction or audit record to Walrus Memory.
 * - If client is configured: submits remember(), waits for job, and records real blobId + writeStatus: "confirmed".
 * - If client is missing: writeStatus: "local-demo" without blobId.
 * - If remember fails: writeStatus: "failed" with explicit writeError. Never silently fakes success.
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
    id: record.id || `mem-${Date.now()}`,
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
    const memoryPayload = JSON.stringify({
      ...newRecord,
      source: "walrus",
    });

    const accepted = await client.remember(memoryPayload);
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
