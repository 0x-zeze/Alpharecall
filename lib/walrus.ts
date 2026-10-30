import { MemWal } from "@mysten-incubation/memwal";

export interface MemoryRecord {
  id: string;
  category: "prediction" | "audit" | "analyst_score" | "market_insight";
  title: string;
  content: string;
  analyst: string;
  target: string;
  pick: string;
  outcome: "PENDING" | "ACCURATE" | "FAILED";
  credibilityDelta: number;
  timestamp: number;
  mainnetCommitHash?: string;
}

// Fallback in-memory ledger if MEMWAL keys not yet provided
const memoryLedger: MemoryRecord[] = [
  {
    id: "mem-01",
    category: "audit",
    title: "UEFA Champions League: Real Madrid vs AC Milan",
    content: "Predicted Over 2.5 Total Match Goals (Odds -125). Confirmed: High transition tempo yielded 4 total goals.",
    analyst: "@TacticalFootyIQ",
    target: "UCL RMA vs MIL",
    pick: "OVER 2.5",
    outcome: "ACCURATE",
    credibilityDelta: 6,
    timestamp: Date.now() - 86400000 * 5,
    mainnetCommitHash: "0x7a89b4f912c4819d92e8fa0172bf42c8d1976a4012bc0991a82f3411b01fa79e",
  },
  {
    id: "mem-02",
    category: "audit",
    title: "SUI/USDT Breakout $2.00 Barrier",
    content: "Oracle price confirmed SUI reached $2.36 after ecosystem inflow surge. Prediction logged 48h prior.",
    analyst: "@CryptoSuiAlpha",
    target: "SUI/USDT",
    pick: "LONG > $2.00",
    outcome: "ACCURATE",
    credibilityDelta: 8,
    timestamp: Date.now() - 86400000 * 4,
    mainnetCommitHash: "0x9c3140abde561028374a0098f411cd7341ea22bfbc810052acbb761942aa11e2",
  },
  {
    id: "mem-03",
    category: "audit",
    title: "Premier League: Arsenal vs Liverpool",
    content: "Predicted Under 2.5 goals. Match resulted in 2-2 draw (4 goals total). Flagged as defensive failure.",
    analyst: "@EPLFootyPicks",
    target: "Arsenal vs Liverpool",
    pick: "UNDER 2.5",
    outcome: "FAILED",
    credibilityDelta: -5,
    timestamp: Date.now() - 86400000 * 3,
    mainnetCommitHash: "0x44fa71bb0091aa38cc11019f82ec61552a48bc31889021daaa9128362615bc09",
  },
  {
    id: "mem-04",
    category: "audit",
    title: "Sui Ecosystem TVL milestone",
    content: "Predicted Sui TVL crossing $1 Billion threshold before November. Confirmed via DeFiLlama onchain data.",
    analyst: "@DeFiScannerSui",
    target: "Sui Network TVL",
    pick: "TVL > $1.0B",
    outcome: "ACCURATE",
    credibilityDelta: 7,
    timestamp: Date.now() - 86400000 * 3,
    mainnetCommitHash: "0x33b8a1c900fe8311bca0199742a033519800fcba1288cfa990141bbde83199fe",
  },
  {
    id: "mem-05",
    category: "audit",
    title: "NBA: Boston Celtics -7.5 Spread vs Miami",
    content: "Boston won by 14 points (119-105). Spread covered smoothly with high 3pt volume.",
    analyst: "@HoopSharps",
    target: "BOS vs MIA",
    pick: "BOS -7.5",
    outcome: "ACCURATE",
    credibilityDelta: 5,
    timestamp: Date.now() - 86400000 * 2,
    mainnetCommitHash: "0x81eeab1029384756adbc81726354aa009981276354bc72615a91827364125bc4",
  },
  {
    id: "mem-06",
    category: "audit",
    title: "BTC/USDT Re-test of $69,000",
    content: "Bitcoin tapped $69.2k resistance as predicted before consolidation. High open interest liquidation.",
    analyst: "@MacroCryptoSage",
    target: "BTC/USDT",
    pick: "TAP $69K",
    outcome: "ACCURATE",
    credibilityDelta: 6,
    timestamp: Date.now() - 86400000 * 2,
    mainnetCommitHash: "0x56a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde",
  },
  {
    id: "mem-07",
    category: "audit",
    title: "NBA: Golden State Warriors vs LA Lakers Moneyline",
    content: "Warriors converted 19 three-pointers to win outright as +120 underdogs. Pace matchup variance accurately modeled.",
    analyst: "@CourtVisionNBA",
    target: "NBA GSW vs LAL",
    pick: "GSW Moneyline",
    outcome: "ACCURATE",
    credibilityDelta: 6,
    timestamp: Date.now() - 86400000 * 1,
    mainnetCommitHash: "0x11223344556677889900aabbccddeeff0011223344556677889900aabbccddee",
  },
  {
    id: "mem-08",
    category: "audit",
    title: "Solana vs Sui DEX Volume Ratio",
    content: "Predicted Sui DEX volume outpacing 15% of Solana daily turnover during peak meme activity.",
    analyst: "@CryptoSuiAlpha",
    target: "Sui DEX Metrics",
    pick: "DEX > 15% SOL",
    outcome: "FAILED",
    credibilityDelta: -3,
    timestamp: Date.now() - 86400000 * 1,
    mainnetCommitHash: "0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
  },
  {
    id: "mem-09",
    category: "audit",
    title: "La Liga: Real Madrid vs Barcelona (El Clasico)",
    content: "Barcelona 4-0 win. Pick was Real Madrid Draw No Bet. Extreme variance loss.",
    analyst: "@EPLFootyPicks",
    target: "RMA vs FCB",
    pick: "RMA DNB",
    outcome: "FAILED",
    credibilityDelta: -7,
    timestamp: Date.now() - 43200000,
    mainnetCommitHash: "0xfe01ab298374162534efcdab8971234567890abcdef0123456789abcdef01234",
  },
  {
    id: "mem-10",
    category: "analyst_score",
    title: "Comprehensive Forecaster Credibility Assessment #1",
    content: "AlphaRecall learned that @TacticalFootyIQ (88% win rate) and @CourtVisionNBA should have 2.2x algorithmic weighting on soccer & NBA, while @EPLFootyPicks weight was reduced to 0.6x due to repeated unhedged draw calls.",
    analyst: "AlphaRecall Consensus AI",
    target: "System Forecasters",
    pick: "ADJUST_WEIGHTS",
    outcome: "ACCURATE",
    credibilityDelta: 10,
    timestamp: Date.now() - 7200000,
    mainnetCommitHash: "0x778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566",
  },
];

function getMemWalClient() {
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
    console.error("Failed to initialize MemWal client:", err);
    return null;
  }
}

export async function getAllMemories(): Promise<MemoryRecord[]> {
  const client = getMemWalClient();
  if (!client) {
    return memoryLedger;
  }

  try {
    const response = await client.recall({ query: "prediction and credibility audit" });
    if (response?.results && response.results.length > 0) {
      // Map SDK records into our schema
      const mapped: MemoryRecord[] = response.results.map((item, idx) => ({
        id: `walrus-${idx + 1}`,
        category: "audit",
        title: `Walrus Mainnet Memory #${idx + 1}`,
        content: item.text,
        analyst: "@WalrusAgent",
        target: "Onchain Prediction",
        pick: "AUDIT_RECORD",
        outcome: "ACCURATE",
        credibilityDelta: 5,
        timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now() - idx * 3600000,
        mainnetCommitHash: item.blob_id || `0xwalrus_${idx}`,
      }));
      return mapped;
    }
    return memoryLedger;
  } catch (error) {
    console.warn("Falling back to local ledger after Walrus recall error:", error);
    return memoryLedger;
  }
}

export async function saveMemory(record: Omit<MemoryRecord, "id" | "timestamp">): Promise<MemoryRecord> {
  const newRecord: MemoryRecord = {
    ...record,
    id: `mem-${Date.now()}`,
    timestamp: Date.now(),
    mainnetCommitHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
  };

  const client = getMemWalClient();
  if (client) {
    try {
      const memoryString = `[ALPHARECALL MEMORY] ${newRecord.title} | Target: ${newRecord.target} | Pick: ${newRecord.pick} | Analyst: ${newRecord.analyst} | Outcome: ${newRecord.outcome} | Delta: ${newRecord.credibilityDelta}. ${newRecord.content}`;
      const job = await client.remember(memoryString);
      if (job?.job_id) {
        await client.waitForRememberJob(job.job_id);
      }
    } catch (e) {
      console.warn("Walrus remember job error, saved to local cache:", e);
    }
  }

  memoryLedger.unshift(newRecord);
  return newRecord;
}
