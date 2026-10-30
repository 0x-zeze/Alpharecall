import { MemWal } from "@mysten-incubation/memwal";
import { PredictionRecord } from "./types";
import { CANONICAL_SEEDS } from "./seed-data";

export type MemoryRecord = PredictionRecord;

// In-memory ledger initialized with authentic canonical records (NO fake hashes)
const memoryLedger: MemoryRecord[] = [...CANONICAL_SEEDS];

function getMemWalClient(): MemWal | null {
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
    console.warn("Failed to initialize MemWal client, operating in local verified mode:", err);
    return null;
  }
}

/**
 * Retrieve all memories from Walrus Memory on Mainnet.
 * Decodes structured JSON payloads and binds authentic Walrus blob_id.
 * Falls back to canonical verified records if offline or keys not provided.
 */
export async function getAllMemories(): Promise<MemoryRecord[]> {
  const client = getMemWalClient();
  if (!client) {
    return memoryLedger;
  }

  try {
    const response = await client.recall({ query: "prediction and credibility audit" });
    if (response?.results && response.results.length > 0) {
      const recalled: MemoryRecord[] = response.results.map((item, idx) => {
        let parsed: Partial<MemoryRecord> = {};
        try {
          parsed = JSON.parse(item.text);
        } catch {
          // If not raw JSON, check if it contains serialized key-values
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
          mainnetCommitHash: item.blob_id, // Real Walrus blob_id from the recall hit
          reasoning: parsed.reasoning,
          postMortem: parsed.postMortem,
          tags: parsed.tags,
        };
      });

      return recalled;
    }
    return memoryLedger;
  } catch (error) {
    console.warn("Falling back to verified local ledger after Walrus recall:", error);
    return memoryLedger;
  }
}

/**
 * Commit a new prediction or audit record to Walrus Memory.
 * Serializes the full structured payload into Walrus text.
 * Stores the REAL Walrus blob_id returned by waitForRememberJob().
 * Never generates fake random hashes.
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
    mainnetCommitHash: undefined, // Only populated if Walrus returns a verified blob_id
  };

  const client = getMemWalClient();
  if (client) {
    try {
      // Serialize full structured object into JSON
      const memoryPayload = JSON.stringify(newRecord);
      const accepted = await client.remember(memoryPayload);
      if (accepted?.job_id) {
        // Wait for terminal state to extract the authentic Walrus blob_id
        const rememberResult = await client.waitForRememberJob(accepted.job_id);
        if (rememberResult?.blob_id) {
          newRecord.mainnetCommitHash = rememberResult.blob_id;
        }
      }
    } catch (e) {
      console.warn("Walrus remember operation failed or queued:", e);
      // Explicitly leave mainnetCommitHash as undefined to reflect local/pending state
    }
  }

  memoryLedger.unshift(newRecord);
  return newRecord;
}
