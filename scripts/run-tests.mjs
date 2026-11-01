import assert from "node:assert/strict";
import {
  encodeMemory,
  decodeMemory,
  payloadToPredictionRecord,
  predictionRecordToPayload,
  MEMORY_PREFIX,
} from "../lib/memory-codec.ts";
import {
  computeWeight,
  computeForecasterStats,
  consensus,
  MIN_CREDIBILITY_WEIGHT,
  MAX_CREDIBILITY_WEIGHT,
} from "../lib/credibility.ts";
import {
  resolveCryptoPrediction,
  resolveDuePredictions,
  calculateOutcomeDelta,
  parseCryptoTarget,
  normalizePriceString,
  RESOLVER_GRACE_WINDOW_MS,
} from "../lib/resolver.ts";
import {
  getTatumGatewayStatus,
  getSuiChainMetrics,
  getLatestSuiCheckpointAnchor,
} from "../lib/tatum.ts";
import { dedupePredictions } from "../lib/dedupe.ts";
import { DEMO_PREDICTIONS } from "../lib/demo-data.ts";
import { setCustomSaveMemory } from "../lib/walrus.ts";
import * as grpc from "@grpc/grpc-js";
import { getSuiLedgerPackageDefinition } from "../lib/sui-grpc.ts";
import {
  parseEspnEvent,
  validateLogoUrl,
} from "../lib/espn.ts";
import {
  SIMULATED_STARTING_BANKROLL,
  activeRisk,
  countOnChainBlobs,
  currentWinStreak,
  simulatedBalance,
  isBacktestRecord,
  countLiveVsBacktest,
} from "../lib/dashboard-stats.ts";
import { settleMarket } from "../lib/sports-resolver.ts";

let passed = 0;
let failed = 0;

async function it(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

async function describe(title, fn) {
  console.log(`\n[SUITE] ${title}`);
  await fn();
}

async function main() {
  console.log("=================================================");
  console.log("  ALPHARECALL COMPREHENSIVE TEST SUITE           ");
  console.log("=================================================");

  // --------------------------------------------------------------------------
  // SUITE 1: Codec & Backward Compatibility
  // --------------------------------------------------------------------------
  await describe("lib/memory-codec - Encode, Decode & Backward Compatibility", async () => {
    const samplePayload = {
      version: "1.0",
      type: "resolution",
      predictionId: "rec-test-01",
      analyst: "@OptaTactics",
      category: "soccer",
      leagueOrAsset: "La Liga",
      title: "El Clasico: Real Madrid vs Barcelona",
      target: "RMA vs FCB",
      pick: "FCB DNB (+125)",
      odds: "+125",
      stake: 300,
      pnl: 375,
      outcome: "ACCURATE",
      delta: 7,
      confidence: 5,
      resolvedAt: "2024-10-26T21:00:00.000Z",
      reasoning: "Tactical high line offside trap.",
      postMortem: "Barcelona routed 4-0.",
      tags: ["ElClasico", "LaLiga"],
      evidence: {
        score: "0-4",
        details: "Lewandowski brace (54', 56')",
      },
    };

    await it("should encode memory payload with ALPHARECALL_V1 prefix", () => {
      const encoded = encodeMemory(samplePayload);
      assert.equal(encoded.startsWith(MEMORY_PREFIX), true);
      assert.equal(encoded.includes('"predictionId":"rec-test-01"'), true);
      assert.equal(encoded.includes('"analyst":"@OptaTactics"'), true);
    });

    await it("should successfully roundtrip encode and decode without data loss", () => {
      const encoded = encodeMemory(samplePayload);
      const decoded = decodeMemory(encoded);

      assert.notEqual(decoded, null);
      assert.equal(decoded?.predictionId, samplePayload.predictionId);
      assert.equal(decoded?.analyst, samplePayload.analyst);
      assert.equal(decoded?.category, samplePayload.category);
      assert.equal(decoded?.pick, samplePayload.pick);
      assert.equal(decoded?.outcome, samplePayload.outcome);
      assert.equal(decoded?.delta, samplePayload.delta);
      assert.equal(decoded?.stake, samplePayload.stake);
      assert.equal(decoded?.pnl, samplePayload.pnl);
      assert.equal(decoded?.resolvedAt, samplePayload.resolvedAt);
      assert.equal(decoded?.evidence?.score, "0-4");
    });

    await it("should preserve strict backward compatibility with legacy mainnet memory strings", () => {
      // Exact raw format stored on Walrus Mainnet for rec-01 (no deadline/direction fields)
      const legacyRawMemory =
        'ALPHARECALL_V1 {"version":"1.0","type":"resolution","predictionId":"rec-01","analyst":"@OptaTactics","category":"soccer","leagueOrAsset":"La Liga","title":"El Clasico: Real Madrid 0 - 4 FC Barcelona","target":"RMA vs FCB (La Liga)","pick":"FCB DNB (+125)","odds":"+125","stake":300,"pnl":375,"outcome":"ACCURATE","delta":7,"confidence":5,"resolvedAt":"2024-10-26T19:00:00.000Z","reasoning":"High line offside trap","postMortem":"Lewandowski brace","tags":["LaLiga","ElClasico"],"evidence":{"details":"Barcelona routed Madrid 4-0"}}';

      const decoded = decodeMemory(legacyRawMemory);
      assert.notEqual(decoded, null);
      assert.equal(decoded?.predictionId, "rec-01");
      assert.equal(decoded?.outcome, "ACCURATE");
      assert.equal(decoded?.delta, 7);
      assert.equal(decoded?.deadline, undefined);
      assert.equal(decoded?.direction, undefined);
      assert.equal(decoded?.targetPrice, undefined);
    });

    await it("legacy memory string without suiCheckpointSource still decodes properly", () => {
      const legacyRawMemory =
        'ALPHARECALL_V1 {"version":"1.0","type":"resolution","predictionId":"rec-legacy-99","analyst":"@OptaTactics","category":"soccer","title":"Legacy Match","target":"RMA vs FCB","pick":"FCB DNB","odds":"+125","stake":300,"pnl":375,"outcome":"ACCURATE","delta":7,"confidence":5,"resolvedAt":"2024-10-26T19:00:00.000Z","suiCheckpoint":"340000000","suiCheckpointDigest":"0xdigest123"}';

      const decoded = decodeMemory(legacyRawMemory);
      assert.notEqual(decoded, null);
      assert.equal(decoded?.predictionId, "rec-legacy-99");
      assert.equal(decoded?.suiCheckpoint, "340000000");
      assert.equal(decoded?.suiCheckpointDigest, "0xdigest123");
      assert.equal(decoded?.suiCheckpointSource, null);

      const record = payloadToPredictionRecord(decoded, "blob-99");
      assert.equal(record.suiCheckpoint, "340000000");
      assert.equal(record.suiCheckpointSource, null);
    });

    await it("memory string with suiCheckpointSource 'tatum-grpc' decodes properly", () => {
      const grpcRawMemory =
        'ALPHARECALL_V1 {"version":"1.0","type":"resolution","predictionId":"rec-grpc-01","analyst":"@OptaTactics","category":"crypto","title":"Crypto Match","target":"SUI/USD","pick":"SUI > $2.00","odds":"-110","stake":300,"pnl":0,"outcome":"PENDING","delta":0,"confidence":4,"resolvedAt":"2026-11-01T12:00:00.000Z","suiCheckpoint":"340555666","suiCheckpointDigest":"0xgrpcDigest","suiCheckpointSource":"tatum-grpc"}';

      const decoded = decodeMemory(grpcRawMemory);
      assert.notEqual(decoded, null);
      assert.equal(decoded?.predictionId, "rec-grpc-01");
      assert.equal(decoded?.suiCheckpoint, "340555666");
      assert.equal(decoded?.suiCheckpointDigest, "0xgrpcDigest");
      assert.equal(decoded?.suiCheckpointSource, "tatum-grpc");

      const record = payloadToPredictionRecord(decoded, "blob-grpc-01");
      assert.equal(record.suiCheckpointSource, "tatum-grpc");
    });

    await it("should reject corrupted, missing, or un-prefixed inputs", () => {
      assert.equal(decodeMemory('{"predictionId":"123"}'), null);
      assert.equal(decodeMemory("Just some random text"), null);
      assert.equal(decodeMemory(""), null);
      assert.equal(decodeMemory(null), null);
      assert.equal(decodeMemory(undefined), null);
      assert.equal(decodeMemory(`${MEMORY_PREFIX}{malformed_json:`), null);
      assert.equal(decodeMemory(`${MEMORY_PREFIX}{"predictionId":"1","analyst":"@test"}`), null);

      const invalidOutcome = { ...samplePayload, outcome: "INVALID_STATUS" };
      assert.equal(decodeMemory(`${MEMORY_PREFIX}${JSON.stringify(invalidOutcome)}`), null);
    });

    await it("should convert PredictionRecord to payload and back faithfully with extension fields", () => {
      const record = {
        id: "rec-test-02",
        category: "audit",
        sportType: "crypto",
        title: "SUI Support Bounce",
        content: "Predicted bounce > $1.85",
        analyst: "@SuiSharps",
        target: "SUI/USDT Support",
        pick: "BOUNCE > $1.85",
        odds: "+120",
        stake: 300,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 5,
        timestamp: 1730000000000,
        dateStr: "Oct 27, 2024",
        writeStatus: "confirmed",
        blobId: "walrus_blob_test_123",
        source: "walrus",
        deadline: "2026-11-01T12:00:00.000Z",
        direction: "above",
        targetPrice: 1.85,
        asset: "SUI",
        suiCheckpoint: "105432000",
      };

      const payload = predictionRecordToPayload(record);
      assert.equal(payload.predictionId, "rec-test-02");
      assert.equal(payload.deadline, "2026-11-01T12:00:00.000Z");
      assert.equal(payload.direction, "above");
      assert.equal(payload.targetPrice, 1.85);

      const reconverted = payloadToPredictionRecord(payload, record.blobId);
      assert.equal(reconverted.id, record.id);
      assert.equal(reconverted.deadline, record.deadline);
      assert.equal(reconverted.direction, "above");
      assert.equal(reconverted.targetPrice, 1.85);
      assert.equal(reconverted.suiCheckpoint, "105432000");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: Credibility Math
  // --------------------------------------------------------------------------
  await describe("lib/credibility - computeWeight Boundary Tests", async () => {
    await it("should return baseline 1.0 when delta is 0", () => {
      assert.equal(computeWeight(0), 1.0);
    });

    await it("should scale up linearly with positive deltas (1.0 + delta / 20)", () => {
      assert.equal(computeWeight(10), 1.5);
      assert.equal(computeWeight(20), 2.0);
      assert.equal(computeWeight(24), 2.2);
    });

    await it("should strictly clamp at MAX_CREDIBILITY_WEIGHT (2.40)", () => {
      assert.equal(computeWeight(28), MAX_CREDIBILITY_WEIGHT);
      assert.equal(computeWeight(100), MAX_CREDIBILITY_WEIGHT);
    });

    await it("should scale down with negative deltas and clamp at MIN_CREDIBILITY_WEIGHT (0.40)", () => {
      assert.equal(computeWeight(-6), 0.7);
      assert.equal(computeWeight(-10), 0.5);
      assert.equal(computeWeight(-12), 0.4);
      assert.equal(computeWeight(-20), MIN_CREDIBILITY_WEIGHT);
    });

    await it("should handle NaN gracefully", () => {
      assert.equal(computeWeight(NaN), 1.0);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: Forecaster Stats & Consensus
  // --------------------------------------------------------------------------
  await describe("lib/credibility - Stats & Consensus Pivot", async () => {
    const mockPredictions = [
      {
        id: "1",
        category: "audit",
        sportType: "soccer",
        title: "Match 1",
        content: "",
        analyst: "@Sharpshooter",
        target: "M1",
        pick: "W",
        odds: "-110",
        stake: 100,
        pnl: 90,
        outcome: "ACCURATE",
        credibilityDelta: 6,
        confidence: 4,
        timestamp: 1000,
        dateStr: "Day 1",
        writeStatus: "confirmed",
        blobId: "blob_1",
      },
      {
        id: "2",
        category: "audit",
        sportType: "soccer",
        title: "Match 2",
        content: "",
        analyst: "@Sharpshooter",
        target: "M2",
        pick: "W",
        odds: "-110",
        stake: 100,
        pnl: 90,
        outcome: "ACCURATE",
        credibilityDelta: 6,
        confidence: 4,
        timestamp: 2000,
        dateStr: "Day 2",
        writeStatus: "confirmed",
        blobId: "blob_2",
      },
    ];

    await it("should compute exact win rates, deltas, and weight multipliers", () => {
      const stats = computeForecasterStats(mockPredictions);
      assert.equal(stats.length, 1);
      const sharp = stats[0];
      assert.equal(sharp.winRate, 100.0);
      assert.equal(sharp.deltaTotal, 12);
      assert.equal(sharp.weightMultiplier, 1.6);
    });

    await it("should dynamically pivot consensus pick when memory boosts sharps", () => {
      const opinions = [
        { analyst: "@HypeGuy1", pick: "FAVORITE -1.5", confidence: 3 },
        { analyst: "@HypeGuy2", pick: "FAVORITE -1.5", confidence: 3 },
        { analyst: "@MasterSharp", pick: "UNDERDOG +1.5", confidence: 4 },
      ];

      const weights = {
        "@HypeGuy1": 0.4,
        "@HypeGuy2": 0.4,
        "@MasterSharp": 2.2,
      };

      const res = consensus("Derby Fixture", opinions, weights);
      assert.equal(res.unweightedPick, "FAVORITE -1.5");
      assert.equal(res.weightedPick, "UNDERDOG +1.5");
      assert.equal(res.pivoted, true);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: BAGIAN 2 - Resolver with Deadlines & Grace Window
  // --------------------------------------------------------------------------
  await describe("lib/resolver - Deadline & Grace Window Invariants", async () => {
    const originalFetch = globalThis.fetch;
    const baseNow = 1730000000000; // Reference baseline time

    await it("should return legacy-no-deadline when forecast has no deadline", async () => {
      const legacyPred = {
        id: "pred-legacy-01",
        sportType: "crypto",
        target: "SUI/USDT Spot",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@LegacyAnalyst",
        stake: 200,
        confidence: 4,
        // no deadline!
      };

      const res = await resolveCryptoPrediction(legacyPred, baseNow);
      assert.equal(res.status, "legacy-no-deadline");
    });

    await it("should return not_due when current time is before deadline", async () => {
      const futurePred = {
        id: "pred-future-01",
        sportType: "crypto",
        target: "SUI/USDT Spot",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 200,
        confidence: 4,
        deadline: new Date(baseNow + 24 * 3600 * 1000).toISOString(), // 24h in future
      };

      const res = await resolveCryptoPrediction(futurePred, baseNow);
      assert.equal(res.status, "not_due");
      assert.equal(res.reason?.includes("not due yet"), true);
    });

    await it("should return expired-unresolved when past the 6-hour grace window", async () => {
      const expiredPred = {
        id: "pred-expired-01",
        sportType: "crypto",
        target: "SUI/USDT Spot",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 200,
        confidence: 4,
        deadline: new Date(baseNow - (RESOLVER_GRACE_WINDOW_MS + 3600000)).toISOString(), // 7h in past
      };

      const res = await resolveCryptoPrediction(expiredPred, baseNow);
      assert.equal(res.status, "expired-unresolved");
      assert.equal(res.reason?.includes("grace window exceeded"), true);
    });

    await it("should resolve ACCURATE for above direction when Tatum price >= target within grace window", async () => {
      process.env.TATUM_API_KEY = "test_key_123";

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
          return {
            ok: true,
            json: async () => ({ value: "2.35", basePair: "USD" }),
          };
        }
        return { ok: false };
      };

      const duePred = {
        id: "pred-due-above-01",
        sportType: "crypto",
        target: "SUI/USDT Breakout",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 300,
        confidence: 5,
        deadline: new Date(baseNow - 1800000).toISOString(), // 30m ago (inside grace window)
        direction: "above",
        targetPrice: 2.0,
        asset: "SUI",
      };

      const res = await resolveCryptoPrediction(duePred, baseNow);
      assert.equal(res.status, "resolved");
      assert.equal(res.outcome, "ACCURATE");
      assert.equal(res.delta, 8); // High confidence 5 win -> +8
      assert.equal(res.evidence?.source, "tatum_data_api");
      assert.equal(res.evidence?.method, "tatum_spot_within_grace");
      assert.equal(res.oracleFallbackUsed, false);
    });

    await it("should resolve FAILED for below direction when price is higher than target", async () => {
      process.env.TATUM_API_KEY = "test_key_123";

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
          return {
            ok: true,
            json: async () => ({ value: "1.50", basePair: "USD" }),
          };
        }
        return { ok: false };
      };

      const duePred = {
        id: "pred-due-below-01",
        sportType: "crypto",
        target: "SUI/USDT Dip Test",
        pick: "SHORT < $1.20",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 300,
        confidence: 3,
        deadline: new Date(baseNow - 1800000).toISOString(),
        direction: "below",
        targetPrice: 1.2,
        asset: "SUI",
      };

      const res = await resolveCryptoPrediction(duePred, baseNow);
      assert.equal(res.status, "resolved");
      assert.equal(res.outcome, "FAILED");
      assert.equal(res.delta, -5); // Standard loss -> -5
    });

    await it("should fail without writing memory when Tatum fails and ALLOW_PUBLIC_ORACLE_FALLBACK is false", async () => {
      process.env.ALLOW_PUBLIC_ORACLE_FALLBACK = "false";

      globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "Tatum internal error" });

      const duePred = {
        id: "pred-due-fail-01",
        sportType: "crypto",
        target: "SUI/USDT Dip Test",
        pick: "SHORT < $1.20",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 300,
        confidence: 3,
        deadline: new Date(baseNow - 1800000).toISOString(),
      };

      const res = await resolveCryptoPrediction(duePred, baseNow);
      assert.equal(res.status, "failed");
      assert.equal(res.reason?.includes("ALLOW_PUBLIC_ORACLE_FALLBACK is false"), true);
    });

    await it("should use public fallback when Tatum fails and ALLOW_PUBLIC_ORACLE_FALLBACK is true", async () => {
      process.env.ALLOW_PUBLIC_ORACLE_FALLBACK = "true";

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io")) {
          return { ok: false, status: 500, text: async () => "Down" };
        }
        if (typeof url === "string" && url.includes("api.coingecko.com")) {
          return {
            ok: true,
            json: async () => ({ sui: { usd: 2.10 } }),
          };
        }
        return { ok: false };
      };

      const duePred = {
        id: "pred-due-fallback-01",
        sportType: "crypto",
        target: "SUI/USDT Dip Test",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@SuiSharp",
        stake: 300,
        confidence: 4,
        deadline: new Date(baseNow - 1800000).toISOString(),
        direction: "above",
        targetPrice: 2.0,
      };

      const res = await resolveCryptoPrediction(duePred, baseNow);
      assert.equal(res.status, "resolved");
      assert.equal(res.evidence?.source, "coingecko_public_fallback");
      assert.equal(res.oracleFallbackUsed, true);
    });

    await it("should parse crypto target and calculate outcome deltas correctly", () => {
      const parsedAbove = parseCryptoTarget("SUI Spot Breakout", "LONG SUI > $2.15");
      assert.equal(parsedAbove?.symbol, "sui");
      assert.equal(parsedAbove?.targetPrice, 2.15);
      assert.equal(parsedAbove?.direction, "above");

      const parsedBelow = parseCryptoTarget("ETH Range Short", "RATIO < 0.038");
      assert.equal(parsedBelow?.symbol, "ethereum");
      assert.equal(parsedBelow?.direction, "below");

      assert.equal(calculateOutcomeDelta("ACCURATE", 5), 8);
      assert.equal(calculateOutcomeDelta("ACCURATE", 4), 6);
      assert.equal(calculateOutcomeDelta("ACCURATE", 2), 4);
      assert.equal(calculateOutcomeDelta("FAILED", 5), -8);
      assert.equal(calculateOutcomeDelta("FAILED", 3), -5);
    });

    await it("should parse leading-zero comma numbers as decimals instead of thousands", () => {
      assert.equal(normalizePriceString("0,925"), 0.925);
      assert.equal(normalizePriceString("$0,925"), 0.925);
      assert.equal(normalizePriceString("0,0925"), 0.0925);
      assert.equal(normalizePriceString("0,89"), 0.89);
      assert.equal(normalizePriceString("1,234"), 1234);
      assert.equal(normalizePriceString("77,890"), 77890);
    });

    await it("should parse comma decimal numbers and thousands separators correctly", () => {
      // Testing ambiguous cases per requirement
      assert.equal(normalizePriceString("1,234"), 1234);
      assert.equal(normalizePriceString("0,9"), 0.9);
      assert.equal(normalizePriceString("1,5"), 1.5);
      assert.equal(normalizePriceString("77,890.50"), 77890.5);
      assert.equal(normalizePriceString("2,50"), 2.5);

      // Additional standard cases
      assert.equal(normalizePriceString("$1,25"), 1.25);
      assert.equal(normalizePriceString("77,890"), 77890);
      assert.equal(normalizePriceString("1,234,567"), 1234567);
      assert.equal(normalizePriceString("69k"), 69000);
      assert.equal(normalizePriceString("69.5k"), 69500);
      assert.equal(normalizePriceString("69,5k"), 69500);

      // Text fallback parsing with comma decimal
      const fallbackParsed = parseCryptoTarget("SUI Spot", "SUI < $0,9");
      assert.notEqual(fallbackParsed, null);
      assert.equal(fallbackParsed?.symbol, "sui");
      assert.equal(fallbackParsed?.direction, "below");
      assert.equal(fallbackParsed?.targetPrice, 0.9);
    });

    await it("resolver uses structured targetPrice first over text fallback", async () => {
      process.env.TATUM_API_KEY = "test_key_123";
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ value: "2.10", basePair: "USD" }),
      });

      const baseNow = Date.now();
      // Text says $0.9 but structured targetPrice is 2.5
      const structuredPred = {
        id: "pred-struct-priority",
        sportType: "crypto",
        target: "SUI/USD",
        pick: "SUI > $0.9", // text has 0.9
        outcome: "PENDING",
        analyst: "@StructuredSharp",
        stake: 250,
        confidence: 4,
        deadline: new Date(baseNow - 1000).toISOString(),
        direction: "above",
        targetPrice: 2.5, // structured priority
      };

      const res = await resolveCryptoPrediction(structuredPred, baseNow);
      assert.equal(res.status, "resolved");
      // Price is 2.10, structured targetPrice is 2.5 -> FAILED
      assert.equal(res.outcome, "FAILED");
    });

    await it("should resolve due candidates idempotently and skip already-resolved records", async () => {
      process.env.TATUM_API_KEY = "test_key_123";
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
          return { ok: true, json: async () => ({ value: "2.35", basePair: "USD" }) };
        }
        return { ok: false };
      };

      const testCand = {
        id: "pred-batch-01",
        sportType: "crypto",
        target: "SUI/USDT Breakout",
        pick: "LONG > $2.00",
        outcome: "PENDING",
        analyst: "@BatchSharp",
        stake: 300,
        confidence: 4,
        deadline: new Date(baseNow - 1800000).toISOString(),
        direction: "above",
        targetPrice: 2.0,
        asset: "SUI",
      };

      // Run 1: resolves
      const report1 = await resolveDuePredictions([testCand], baseNow);
      assert.equal(report1.resolvedCount, 1);

      // Run 2: skips idempotently
      const report2 = await resolveDuePredictions([testCand], baseNow);
      assert.equal(report2.resolvedCount, 0);
      assert.equal(report2.skippedCount, 1);
    });

    globalThis.fetch = originalFetch;
  });

  // --------------------------------------------------------------------------
  // SUITE 5: BAGIAN 3 - Honest Tatum Gateway & Sui RPC Parsing
  // --------------------------------------------------------------------------
  await describe("lib/tatum - Gateway Telemetry & Sui RPC Parsing", async () => {
    const originalFetch = globalThis.fetch;

    await it("should parse authentic Tatum Gateway metadata without fabricated defaults", async () => {
      process.env.TATUM_API_KEY = "test_tatum_key";

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io/v3/tatum/version")) {
          return {
            ok: true,
            json: async () => ({
              version: "3.18.3",
              planName: "Free",
              creditLimit: 100000,
              usage: 4750,
            }),
          };
        }
        return { ok: false };
      };

      const status = await getTatumGatewayStatus();
      assert.equal(status.ok, true);
      assert.equal(status.status, "live");
      assert.equal(status.plan, "Free");
      assert.equal(status.creditLimit, 100000);
      assert.equal(status.usage, 4750);
      assert.equal(status.version, "v3.18.3");
    });

    function startMockGrpcServer(handlers = {}) {
      return new Promise((resolve, reject) => {
        const pkg = getSuiLedgerPackageDefinition();
        const proto = grpc.loadPackageDefinition(pkg);
        const server = new grpc.Server();

        server.addService(proto.sui.rpc.v2.LedgerService.service, {
          GetServiceInfo:
            handlers.getServiceInfo ||
            ((call, callback) => {
              callback(null, {});
            }),
          GetCheckpoint:
            handlers.getCheckpoint ||
            ((call, callback) => {
              callback(null, {});
            }),
        });

        server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (err, port) => {
          if (err) reject(err);
          else resolve({ server, port, endpoint: `127.0.0.1:${port}` });
        });
      });
    }

    await it("Tatum gRPC success -> source 'tatum-grpc', isTatumGateway true, numbers parsed correctly", async () => {
      const mockServer = await startMockGrpcServer({
        getServiceInfo: (call, callback) => {
          const key = call.metadata.get("x-api-key")[0];
          if (key !== "test_grpc_api_key_123") {
            return callback({ code: grpc.status.UNAUTHENTICATED, details: "Invalid key" });
          }
          callback(null, {
            chainId: "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S",
            chain: "mainnet",
            epoch: "1299",
            checkpointHeight: "340555666",
            timestamp: { seconds: "1730000000", nanos: 0 },
          });
        },
        getCheckpoint: (call, callback) => {
          callback(null, {
            checkpoint: {
              sequenceNumber: "340555666",
              digest: "0xMockDigestMainnet",
            },
          });
        },
      });

      process.env.TATUM_SUI_GRPC_ENDPOINT = mockServer.endpoint;
      process.env.TATUM_API_KEY = "test_grpc_api_key_123";

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.status, "live");
      assert.equal(chain.source, "tatum-grpc");
      assert.equal(chain.isTatumGateway, true);
      assert.equal(chain.checkpoint, "340555666");
      assert.equal(chain.checkpointDigest, "0xMockDigestMainnet");
      assert.equal(chain.epoch, "1299");
      assert.equal(chain.chainId, "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S");
      assert.equal(chain.referenceGasPrice, null); // Strictly null in gRPC
      assert.equal(chain.gatewayWarning, null);

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, "340555666");
      assert.equal(anchor.digest, "0xMockDigestMainnet");
      assert.equal(anchor.source, "tatum-grpc");

      mockServer.server.forceShutdown();
    });

    await it("Tatum gRPC unauthenticated (missing/invalid key) -> fallback to next source and gatewayWarning recorded", async () => {
      const mockServer = await startMockGrpcServer({
        getServiceInfo: (call, callback) => {
          callback({ code: grpc.status.UNAUTHENTICATED, details: "Invalid API key" });
        },
      });

      process.env.TATUM_SUI_GRPC_ENDPOINT = mockServer.endpoint;
      process.env.TATUM_API_KEY = "wrong_or_missing_key";

      // Mock JSON-RPC to 404 and GraphQL to success
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("gateway.tatum.io")) {
          return { ok: false, status: 404, text: async () => '{"statusCode": 404, "message": "Not Found"}' };
        }
        if (typeof url === "string" && url.includes("graphql.mainnet.sui.io")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                checkpoint: {
                  sequenceNumber: 340999000,
                  digest: "0xFallbackDigest",
                  epoch: { epochId: 1300, referenceGasPrice: "100" },
                },
                chainIdentifier: "chain_sui_mainnet",
              },
            }),
          };
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.source, "sui-graphql");
      assert.equal(chain.isTatumGateway, false);
      assert.equal(chain.checkpoint, "340999000");
      assert.ok(chain.gatewayWarning?.includes("Tatum gRPC auth failed"));

      mockServer.server.forceShutdown();
    });

    await it("Tatum gRPC server unreachable / timeout -> doesn't hang, gracefully falls back", async () => {
      // Point to an inactive port that immediately closes
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997";
      process.env.TATUM_API_KEY = "test_key_123";

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("gateway.tatum.io")) {
          return { ok: false, status: 404, text: async () => "Not Found" };
        }
        if (typeof url === "string" && url.includes("graphql.mainnet.sui.io")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                checkpoint: {
                  sequenceNumber: 340888111,
                  digest: "0xUnreachableDigest",
                  epoch: { epochId: 1300 },
                },
                chainIdentifier: "chain_sui_mainnet",
              },
            }),
          };
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.source, "sui-graphql");
      assert.equal(chain.isTatumGateway, false);
      assert.equal(chain.checkpoint, "340888111");
      assert.ok(chain.gatewayWarning?.includes("Tatum gRPC unreachable"));
    });

    await it("Tatum gRPC GetCheckpoint fails but GetServiceInfo succeeds -> checkpoint preserved with digest null", async () => {
      const mockServer = await startMockGrpcServer({
        getServiceInfo: (call, callback) => {
          callback(null, {
            chainId: "chain_sui_mainnet",
            chain: "mainnet",
            epoch: "1299",
            checkpointHeight: "340777888",
          });
        },
        getCheckpoint: (call, callback) => {
          callback({ code: grpc.status.NOT_FOUND, details: "Pruned historical checkpoint" });
        },
      });

      process.env.TATUM_SUI_GRPC_ENDPOINT = mockServer.endpoint;
      process.env.TATUM_API_KEY = "test_key_123";

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.source, "tatum-grpc");
      assert.equal(chain.isTatumGateway, true);
      assert.equal(chain.checkpoint, "340777888");
      assert.equal(chain.checkpointDigest, null); // Strictly null, never fabricated

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, "340777888");
      assert.equal(anchor.digest, null);
      assert.equal(anchor.source, "tatum-grpc");

      mockServer.server.forceShutdown();
    });

    await it("gateway success -> source 'tatum-gateway', isTatumGateway true", async () => {
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997"; // Force gRPC to failover to JSON-RPC
      globalThis.fetch = async (url, opts) => {
        const bodyStr = opts?.body ? String(opts.body) : "";
        if (typeof url === "string" && url.includes("sui-mainnet.gateway.tatum.io")) {
          if (bodyStr.includes("sui_getLatestCheckpointSequenceNumber")) {
            return { ok: true, json: async () => ({ result: "340111222" }) };
          }
          if (bodyStr.includes("sui_getCheckpoint")) {
            return { ok: true, json: async () => ({ result: { digest: "tatumDigest123" } }) };
          }
          if (bodyStr.includes("suix_getReferenceGasPrice")) {
            return { ok: true, json: async () => ({ result: "750" }) };
          }
          if (bodyStr.includes("suix_getLatestSuiSystemState")) {
            return { ok: true, json: async () => ({ result: { epoch: "1290" } }) };
          }
          if (bodyStr.includes("sui_getChainIdentifier")) {
            return { ok: true, json: async () => ({ result: "chain_sui_mainnet" }) };
          }
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.status, "live");
      assert.equal(chain.checkpoint, "340111222");
      assert.equal(chain.checkpointDigest, "tatumDigest123");
      assert.equal(chain.epoch, "1290");
      assert.equal(chain.referenceGasPrice, "750 MIST");
      assert.equal(chain.chainId, "chain_sui_mainnet");
      assert.equal(chain.source, "tatum-gateway");
      assert.equal(chain.isTatumGateway, true);

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, "340111222");
      assert.equal(anchor.digest, "tatumDigest123");
      assert.equal(anchor.source, "tatum-gateway");
    });

    await it("gateway 404 + GraphQL success -> source 'sui-graphql', isTatumGateway false", async () => {
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997"; // Force gRPC to failover
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("gateway.tatum.io")) {
          return {
            ok: false,
            status: 404,
            text: async () => '{"statusCode": 404, "message": "Not Found"}',
          };
        }
        if (typeof url === "string" && url.includes("graphql.mainnet.sui.io")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                checkpoint: {
                  sequenceNumber: 340214800,
                  digest: "9sGCvW8Tmc2cwPsGQrhaS1mfnVnrRWXnvRUH6qMXDNvU",
                  epoch: {
                    epochId: 1297,
                    referenceGasPrice: "100",
                  },
                },
                chainIdentifier: "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S",
              },
            }),
          };
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, true);
      assert.equal(chain.status, "live");
      assert.equal(chain.checkpoint, "340214800");
      assert.equal(chain.checkpointDigest, "9sGCvW8Tmc2cwPsGQrhaS1mfnVnrRWXnvRUH6qMXDNvU");
      assert.equal(chain.epoch, "1297");
      assert.equal(chain.referenceGasPrice, "100 MIST");
      assert.equal(chain.chainId, "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S");
      assert.equal(chain.source, "sui-graphql");
      assert.equal(chain.isTatumGateway, false);
      assert.ok(chain.gatewayWarning?.includes("404"));

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, "340214800");
      assert.equal(anchor.digest, "9sGCvW8Tmc2cwPsGQrhaS1mfnVnrRWXnvRUH6qMXDNvU");
      assert.equal(anchor.source, "sui-graphql");
    });

    await it("all sources fail -> ok:false, source null, anchor null", async () => {
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997";
      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, false);
      assert.equal(chain.status, "unavailable");
      assert.equal(chain.source, null);
      assert.equal(chain.checkpoint, null);

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, null);
      assert.equal(anchor.digest, null);
      assert.equal(anchor.source, null);
    });

    await it("API key is never leaked in any error string or gatewayWarning", async () => {
      const SECRET_KEY = "SUPER_SECRET_KEY_EXPOSURE_TEST_999";
      process.env.TATUM_API_KEY = SECRET_KEY;
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997";

      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => `Error mentioning ${SECRET_KEY} directly`,
      });

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, false);
      assert.equal(chain.error?.includes(SECRET_KEY), false);
      if (chain.gatewayWarning) {
        assert.equal(chain.gatewayWarning.includes(SECRET_KEY), false);
      }
    });

    await it("GraphQL returns errors[] -> treated as failure", async () => {
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997";
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("gateway.tatum.io")) {
          return { ok: false, status: 404, text: async () => "Not Found" };
        }
        if (typeof url === "string" && url.includes("graphql.mainnet.sui.io")) {
          return {
            ok: true,
            json: async () => ({
              errors: [{ message: "Cannot query field 'invalidField' on type 'Query'" }],
            }),
          };
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, false);
      assert.equal(chain.status, "unavailable");
      assert.equal(chain.source, null);
      assert.equal(chain.checkpoint, null);
    });

    await it("GraphQL timeout -> fails gracefully without hanging", async () => {
      process.env.TATUM_SUI_GRPC_ENDPOINT = "127.0.0.1:59997";
      globalThis.fetch = async (url, opts) => {
        if (typeof url === "string" && url.includes("gateway.tatum.io")) {
          return { ok: false, status: 404, text: async () => "Not Found" };
        }
        if (typeof url === "string" && url.includes("graphql.mainnet.sui.io")) {
          assert.ok(opts?.signal, "GraphQL call must pass an AbortSignal");
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          throw err;
        }
        return { ok: false, status: 500 };
      };

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, false);
      assert.equal(chain.status, "unavailable");
      assert.equal(chain.source, null);
      assert.equal(chain.checkpoint, null);
    });

    globalThis.fetch = originalFetch;
  });

  // --------------------------------------------------------------------------
  // SUITE 6: BAGIAN 4 - Endpoint Security, Rate Limits & Authentication Gates
  // --------------------------------------------------------------------------
  await describe("API Route Security & Write Gate Invariants", async () => {
    // Import API route handlers dynamically
    const { POST: postMemory } = await import("../app/api/memories/route.ts");
    const { GET: getCronResolve } = await import("../app/api/resolve/route.ts");
    const { POST: postSeed } = await import("../app/api/seed/route.ts");

    await it("should sanitize client input and strictly enforce outcome='PENDING' and delta=0", async () => {
      const maliciousBody = {
        title: "Malicious Attack Forecast",
        target: "SUI/USDT Hack",
        pick: "OVER 999",
        analyst: "@EvilAttacker",
        outcome: "ACCURATE", // Client attempts to force ACCURATE
        credibilityDelta: 100, // Client attempts to force +100 delta
        sportType: "soccer",
      };

      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousBody),
      });

      const res = await postMemory(req);
      const json = await res.json();

      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.outcome, "PENDING"); // Must be sanitized to PENDING
      assert.equal(json.data.credibilityDelta, 0); // Must be sanitized to 0
    });

    await it("should reject crypto forecast without deadline with HTTP 400", async () => {
      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "SUI Missing Deadline",
          target: "SUI/USDT Spot",
          pick: "LONG > $2.00",
          analyst: "@CryptoTrader",
          sportType: "crypto",
          // missing deadline!
        }),
      });

      const res = await postMemory(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.success, false);
      assert.equal(json.error?.includes("deadline"), true);
    });

    await it("should reject crypto forecast without valid targetPrice > 0 with HTTP 400", async () => {
      const futureDeadline = new Date(Date.now() + 86400000).toISOString();
      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "SUI Missing Target Price",
          target: "SUI/USD",
          pick: "SUI > $0",
          analyst: "@CryptoTrader",
          sportType: "crypto",
          deadline: futureDeadline,
          targetPrice: 0, // Invalid targetPrice 0
        }),
      });

      const res = await postMemory(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.success, false);
      assert.equal(json.error?.includes("targetPrice"), true);
    });

    await it("should reject invalid analyst handles that fail regex @[A-Za-z0-9_]{3,30}", async () => {
      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Invalid Analyst Format",
          target: "SUI/USDT Spot",
          pick: "LONG > $2.00",
          analyst: "no_at_symbol",
          sportType: "soccer",
        }),
      });

      const res = await postMemory(req);
      const json = await res.json();

      assert.equal(res.status, 400);
      assert.equal(json.success, false);
      assert.equal(json.error?.includes("Analyst handle must start with '@'"), true);
    });

    await it("clientRequestId deduplication: two POSTs with same clientRequestId -> only one saveMemory write", async () => {
      let saveCount = 0;
      setCustomSaveMemory(async (record) => {
        saveCount++;
        return {
          id: "rec-dedupe-test-01",
          category: "prediction",
          sportType: record.sportType,
          title: record.title,
          content: record.content,
          analyst: record.analyst,
          target: record.target,
          pick: record.pick,
          odds: record.odds,
          stake: record.stake,
          pnl: 0,
          outcome: "PENDING",
          credibilityDelta: 0,
          confidence: 4,
          timestamp: Date.now(),
          dateStr: "Nov 1",
          writeStatus: "confirmed",
          source: "walrus",
        };
      });

      const clientRequestId = "req-uuid-test-" + Date.now();
      const payload = {
        title: "Dedupe Request Test",
        target: "BTC/USDT Breakout",
        pick: "BTC > $70000",
        analyst: "@DedupeTester",
        sportType: "soccer", // soccer so deadline is optional
        clientRequestId,
      };

      const req1 = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res1 = await postMemory(req1);
      const json1 = await res1.json();
      assert.equal(res1.status, 200);
      assert.equal(json1.success, true);
      assert.equal(saveCount, 1);

      // Second identical request with same clientRequestId
      const req2 = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res2 = await postMemory(req2);
      const json2 = await res2.json();
      assert.equal(res2.status, 200);
      assert.equal(json2.success, true);
      assert.equal(saveCount, 1); // Crucial invariant: saveMemory is NOT called a second time!
      assert.equal(json2.data.id, "rec-dedupe-test-01");

      // Reset mock
      setCustomSaveMemory(null);
    });

    await it("duplicate forecast (analyst + target + pick + deadline) within 60s returns HTTP 409", async () => {
      const payload = {
        title: "Duplicate Check Test",
        target: "Arsenal vs Chelsea",
        pick: "Arsenal ML",
        analyst: "@UniqueAnalyst",
        sportType: "soccer",
      };

      const req1 = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res1 = await postMemory(req1);
      assert.equal(res1.status, 200);

      // Second request with different clientRequestId, but identical forecast within 60 seconds
      const req2 = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          clientRequestId: "different-id-" + Math.random(),
        }),
      });
      const res2 = await postMemory(req2);
      const json2 = await res2.json();
      assert.equal(res2.status, 409);
      assert.equal(json2.success, false);
      assert.ok(json2.error?.includes("Duplicate prediction"));
    });

    await it("should reject cron resolution GET /api/resolve when CRON_SECRET is missing or wrong (fail-closed)", async () => {
      process.env.CRON_SECRET = "super_secret_cron_token_xyz";

      // Case 1: missing Authorization header
      const reqUnauthed = new Request("http://localhost:3000/api/resolve", {
        method: "GET",
      });
      const res1 = await getCronResolve(reqUnauthed);
      assert.equal(res1.status, 401);

      // Case 2: wrong Bearer token
      const reqWrong = new Request("http://localhost:3000/api/resolve", {
        method: "GET",
        headers: { authorization: "Bearer wrong_token" },
      });
      const res2 = await getCronResolve(reqWrong);
      assert.equal(res2.status, 401);
    });

    await it("should reject seeding POST /api/seed when ADMIN_SECRET does not match with HTTP 403", async () => {
      process.env.ADMIN_SECRET = "production_admin_secret_999";

      const req = new Request("http://localhost:3000/api/seed", {
        method: "POST",
        headers: { "x-admin-secret": "wrong_secret" },
      });

      const res = await postSeed(req);
      const json = await res.json();

      assert.equal(res.status, 403);
      assert.equal(json.success, false);
      assert.equal(json.error?.includes("Forbidden"), true);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 7: BAGIAN 1 - Record Deduplication & E2E Resolution Guarantees
  // --------------------------------------------------------------------------
  await describe("lib/dedupe - Record Deduplication & E2E Resolution Guarantees", async () => {
    const originalFetch = globalThis.fetch;

    await it("pending + resolved with same id -> only resolved remains, stats count 1 pick, delta is not doubled", () => {
      const pending = {
        id: "pred-dupe-1",
        category: "audit",
        sportType: "crypto",
        title: "SUI Support Bounce",
        content: "Predicted bounce > $1.85",
        analyst: "@DedupSharp",
        target: "SUI/USDT Support",
        pick: "BOUNCE > $1.85",
        odds: "+120",
        stake: 200,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 4,
        timestamp: 1730000000000,
        dateStr: "Oct 27",
        writeStatus: "local-demo",
        reasoning: "Deep orderbook support",
      };

      const resolved = {
        id: "pred-dupe-1",
        category: "audit",
        sportType: "crypto",
        title: "Resolution: SUI Support Bounce",
        content: "SUI resolved at $2.10",
        analyst: "@DedupSharp",
        target: "SUI/USDT Support",
        pick: "BOUNCE > $1.85",
        odds: "+120",
        stake: 200,
        pnl: 180,
        outcome: "ACCURATE",
        credibilityDelta: 6,
        confidence: 4,
        timestamp: 1730010000000,
        dateStr: "Oct 27",
        writeStatus: "confirmed",
        blobId: "walrus_blob_res_123",
      };

      // 1. Direct dedupe call
      const deduped = dedupePredictions([pending, resolved]);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].id, "pred-dupe-1");
      assert.equal(deduped[0].outcome, "ACCURATE");
      assert.equal(deduped[0].credibilityDelta, 6);
      assert.equal(deduped[0].pnl, 180);
      assert.equal(deduped[0].blobId, "walrus_blob_res_123");
      // Preserved metadata from pending
      assert.equal(deduped[0].reasoning, "Deep orderbook support");

      // 2. computeForecasterStats called with dirty array directly (defensive layer)
      const stats = computeForecasterStats([pending, resolved]);
      assert.equal(stats.length, 1);
      const s = stats[0];
      assert.equal(s.handle, "@DedupSharp");
      assert.equal(s.totalPicks, 1); // exactly 1 pick, NOT 2!
      assert.equal(s.wins, 1);
      assert.equal(s.pending, 0); // pending row eliminated
      assert.equal(s.deltaTotal, 6); // delta not doubled!
      assert.equal(s.netPnl, 180);
    });

    await it("resolved appears before pending in array -> identical result", () => {
      const pending = {
        id: "pred-dupe-rev",
        category: "audit",
        sportType: "crypto",
        title: "BTC Range High",
        content: "",
        analyst: "@RevSharp",
        target: "BTC/USDT",
        pick: "LONG > $70k",
        odds: "+110",
        stake: 100,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 3,
        timestamp: 1000,
        dateStr: "Day 1",
        writeStatus: "local-demo",
        reasoning: "Range high breakout",
      };

      const resolved = {
        id: "pred-dupe-rev",
        category: "audit",
        sportType: "crypto",
        title: "Resolution: BTC Range High",
        content: "BTC resolved at $71k",
        analyst: "@RevSharp",
        target: "BTC/USDT",
        pick: "LONG > $70k",
        odds: "+110",
        stake: 100,
        pnl: 110,
        outcome: "ACCURATE",
        credibilityDelta: 6,
        confidence: 3,
        timestamp: 2000,
        dateStr: "Day 2",
        writeStatus: "confirmed",
      };

      // Array with resolved first, pending second
      const deduped = dedupePredictions([resolved, pending]);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].outcome, "ACCURATE");
      assert.equal(deduped[0].timestamp, 2000);
      assert.equal(deduped[0].reasoning, "Range high breakout");
    });

    await it("two pending with same id -> newest timestamp wins", () => {
      const p1 = {
        id: "pred-pending-dup",
        category: "audit",
        sportType: "soccer",
        title: "Match A",
        content: "Draft",
        analyst: "@Footy",
        target: "Match A",
        pick: "W1",
        odds: "-110",
        stake: 100,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 2,
        timestamp: 1000,
        dateStr: "Day 1",
        writeStatus: "local-demo",
        reasoning: "Initial draft reasoning",
      };

      const p2 = {
        id: "pred-pending-dup",
        category: "audit",
        sportType: "soccer",
        title: "Match A Updated",
        content: "Updated pick",
        analyst: "@Footy",
        target: "Match A",
        pick: "W1",
        odds: "-110",
        stake: 100,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 3,
        timestamp: 3000, // Newer!
        dateStr: "Day 2",
        writeStatus: "local-demo",
        reasoning: "Refined tactical reasoning",
      };

      const deduped1 = dedupePredictions([p1, p2]);
      assert.equal(deduped1.length, 1);
      assert.equal(deduped1[0].timestamp, 3000);
      assert.equal(deduped1[0].title, "Match A Updated");
      assert.equal(deduped1[0].reasoning, "Refined tactical reasoning");

      const deduped2 = dedupePredictions([p2, p1]);
      assert.equal(deduped2.length, 1);
      assert.equal(deduped2[0].timestamp, 3000);
      assert.equal(deduped2[0].title, "Match A Updated");
    });

    await it("two resolved with same id, different outcome -> newest timestamp wins, no crash", () => {
      const r1 = {
        id: "res-conflict",
        category: "audit",
        sportType: "crypto",
        title: "Old Resolution",
        content: "Erroneous early settlement",
        analyst: "@Analyst",
        target: "SUI",
        pick: "OVER 2",
        odds: "+100",
        stake: 100,
        pnl: 100,
        outcome: "ACCURATE",
        credibilityDelta: 6,
        confidence: 3,
        timestamp: 1000,
        dateStr: "Day 1",
        writeStatus: "confirmed",
      };

      const r2 = {
        id: "res-conflict",
        category: "audit",
        sportType: "crypto",
        title: "Corrected Resolution",
        content: "Official final settlement",
        analyst: "@Analyst",
        target: "SUI",
        pick: "OVER 2",
        odds: "+100",
        stake: 100,
        pnl: -100,
        outcome: "FAILED",
        credibilityDelta: -5,
        confidence: 3,
        timestamp: 5000, // Newer!
        dateStr: "Day 2",
        writeStatus: "confirmed",
      };

      const deduped = dedupePredictions([r1, r2]);
      assert.equal(deduped.length, 1);
      assert.equal(deduped[0].outcome, "FAILED");
      assert.equal(deduped[0].timestamp, 5000);
      assert.equal(deduped[0].credibilityDelta, -5);
      assert.equal(deduped[0].pnl, -100);
    });

    await it("non-empty metadata from pending is preserved after merge", () => {
      const pendingWithMeta = {
        id: "meta-test-01",
        category: "prediction",
        sportType: "crypto",
        title: "SUI Macro Breakout",
        content: "Full thesis",
        analyst: "@MacroDesk",
        target: "SUI/USDT",
        pick: "LONG > $2.20",
        odds: "+145",
        stake: 500,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 5,
        timestamp: 1730000000000,
        dateStr: "Oct 27",
        writeStatus: "local-demo",
        reasoning: "Liquidity aggregation on DEX volumes",
        deadline: "2026-11-02T12:00:00.000Z",
        direction: "above",
        targetPrice: 2.2,
        asset: "SUI",
        tags: ["Sui", "Macro", "Breakout"],
        suiCheckpoint: "10555500",
        suiCheckpointDigest: "0xdigest123",
      };

      // Resolution record might omit some metadata fields
      const resolutionWithoutMeta = {
        id: "meta-test-01",
        category: "audit",
        sportType: "crypto",
        title: "Resolution: SUI Macro Breakout",
        content: "Target achieved at $2.31",
        analyst: "@MacroDesk",
        target: "SUI/USDT",
        pick: "LONG > $2.20",
        odds: "+145",
        stake: 500,
        pnl: 450,
        outcome: "ACCURATE",
        credibilityDelta: 8,
        confidence: 5,
        timestamp: 1730086400000,
        dateStr: "Oct 28",
        writeStatus: "confirmed",
        blobId: "walrus_blob_final_999",
        postMortem: "SUI pumped 14% past target",
      };

      const deduped = dedupePredictions([pendingWithMeta, resolutionWithoutMeta]);
      assert.equal(deduped.length, 1);
      const m = deduped[0];
      assert.equal(m.outcome, "ACCURATE");
      assert.equal(m.pnl, 450);
      assert.equal(m.blobId, "walrus_blob_final_999");
      assert.equal(m.postMortem, "SUI pumped 14% past target");
      // Preserved from pending:
      assert.equal(m.reasoning, "Liquidity aggregation on DEX volumes");
      assert.equal(m.deadline, "2026-11-02T12:00:00.000Z");
      assert.equal(m.direction, "above");
      assert.equal(m.targetPrice, 2.2);
      assert.equal(m.asset, "SUI");
      assert.deepEqual(m.tags, ["Sui", "Macro", "Breakout"]);
      assert.equal(m.suiCheckpoint, "10555500");
      assert.equal(m.suiCheckpointDigest, "0xdigest123");
    });

    await it("consensus does not count the same pick or analyst twice", () => {
      // Opinion list with duplicate analyst entries
      const opinions = [
        { analyst: "@SharpOne", pick: "OVER 2.5", confidence: 4 },
        { analyst: "@SharpOne", pick: "UNDER 2.5", confidence: 2 }, // Duplicate analyst!
        { analyst: "@SharpTwo", pick: "OVER 2.5", confidence: 3 },
      ];

      const weights = {
        "@SharpOne": 2.0,
        "@SharpTwo": 1.0,
      };

      const res = consensus("Match Consensus Test", opinions, weights);
      // Only 2 distinct opinions evaluated (@SharpOne first choice and @SharpTwo)
      assert.equal(res.unweightedConfidence, 100); // Both kept opinions are "OVER 2.5"
      assert.equal(res.weightedPick, "OVER 2.5");
      assert.equal(res.breakdown.length, 1);
      assert.deepEqual(res.breakdown[0].supportingAnalysts, ["@SharpOne", "@SharpTwo"]);
    });

    await it("regression: 16 seed records (unique ids) remain completely unchanged after dedupe", () => {
      const dedupedSeeds = dedupePredictions(DEMO_PREDICTIONS);
      assert.equal(dedupedSeeds.length, DEMO_PREDICTIONS.length);
      assert.equal(dedupedSeeds.length, 16);

      for (let i = 0; i < DEMO_PREDICTIONS.length; i++) {
        assert.equal(dedupedSeeds[i].id, DEMO_PREDICTIONS[i].id);
        assert.equal(dedupedSeeds[i].outcome, DEMO_PREDICTIONS[i].outcome);
        assert.equal(dedupedSeeds[i].target, DEMO_PREDICTIONS[i].target);
        assert.equal(dedupedSeeds[i].stake, DEMO_PREDICTIONS[i].stake);
        assert.equal(dedupedSeeds[i].credibilityDelta, DEMO_PREDICTIONS[i].credibilityDelta);
      }
    });

    await it("End-to-end offline flow: pending crypto prediction -> resolver produces resolution (mock Tatum) -> state update -> stats contains exactly 1 record and analyst weight updates accordingly", async () => {
      process.env.TATUM_API_KEY = "mock_tatum_key_e2e";
      process.env.ALLOW_PUBLIC_ORACLE_FALLBACK = "false";

      const mockDeadlineTime = Date.parse("2024-10-27T10:00:00.000Z");
      const mockResolveTime = Date.parse("2024-10-27T11:00:00.000Z"); // Within 6h grace

      // 1. Initial pending forecast created
      const pendingForecast = {
        id: "e2e-pred-sui-01",
        category: "prediction",
        sportType: "crypto",
        title: "SUI Target Test",
        content: "Anticipating SUI breakout > $2.00",
        analyst: "@E2EQuant",
        target: "SUI/USDT Spot Breakout",
        pick: "LONG SUI > $2.00",
        odds: "+125",
        stake: 300,
        pnl: 0,
        outcome: "PENDING",
        credibilityDelta: 0,
        confidence: 5,
        timestamp: mockDeadlineTime - 3600000,
        dateStr: "Oct 27, 2024",
        writeStatus: "confirmed",
        deadline: new Date(mockDeadlineTime).toISOString(),
        direction: "above",
        targetPrice: 2.0,
        asset: "SUI",
        reasoning: "Onchain liquidity expansion",
      };

      // Baseline stats before resolution
      const statsBefore = computeForecasterStats([pendingForecast]);
      assert.equal(statsBefore.length, 1);
      assert.equal(statsBefore[0].totalPicks, 1);
      assert.equal(statsBefore[0].pending, 1);
      assert.equal(statsBefore[0].wins, 0);
      assert.equal(statsBefore[0].deltaTotal, 0);
      assert.equal(statsBefore[0].weightMultiplier, 1.0); // Baseline weight

      // 2. Mock Tatum rate returning $2.30 (> target $2.00)
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
          return {
            ok: true,
            json: async () => ({ value: "2.30", basePair: "USD" }),
          };
        }
        return { ok: false };
      };

      // 3. Resolver executes
      const resolution = await resolveCryptoPrediction(pendingForecast, mockResolveTime);
      assert.equal(resolution.status, "resolved");
      assert.equal(resolution.outcome, "ACCURATE");
      assert.equal(resolution.delta, 8); // High confidence 5 win -> +8

      // 4. Create resolution record (as written to Walrus storage)
      const resolutionRecord = {
        id: pendingForecast.id,
        category: "audit",
        sportType: "crypto",
        title: `Resolution: ${pendingForecast.title}`,
        content: resolution.evidence.details,
        analyst: pendingForecast.analyst,
        target: pendingForecast.target,
        pick: pendingForecast.pick,
        odds: pendingForecast.odds,
        stake: pendingForecast.stake,
        pnl: 270,
        outcome: resolution.outcome,
        credibilityDelta: resolution.delta,
        confidence: pendingForecast.confidence,
        timestamp: mockResolveTime,
        dateStr: "Oct 27, 2024",
        writeStatus: "confirmed",
        blobId: "walrus_blob_e2e_res_888",
        postMortem: resolution.evidence.details,
      };

      // 5. Simulate state update where storage contains both pending and resolved records
      const storageState = [resolutionRecord, pendingForecast];

      // Verification A: dedupePredictions merges them into exactly 1 record
      const clientState = dedupePredictions(storageState);
      assert.equal(clientState.length, 1);
      assert.equal(clientState[0].id, "e2e-pred-sui-01");
      assert.equal(clientState[0].outcome, "ACCURATE");
      assert.equal(clientState[0].pnl, 270);
      assert.equal(clientState[0].reasoning, "Onchain liquidity expansion"); // Preserved!
      assert.equal(clientState[0].blobId, "walrus_blob_e2e_res_888");

      // Verification B: computeForecasterStats accurately counts 1 pick, 0 pending, 1 win, and weight upgrades to 1.40x
      const statsAfter = computeForecasterStats(storageState);
      assert.equal(statsAfter.length, 1);
      const e2eAnalyst = statsAfter[0];
      assert.equal(e2eAnalyst.totalPicks, 1); // NOT 2!
      assert.equal(e2eAnalyst.pending, 0); // NOT 1!
      assert.equal(e2eAnalyst.wins, 1);
      assert.equal(e2eAnalyst.losses, 0);
      assert.equal(e2eAnalyst.deltaTotal, 8); // 1.0 + 8/20 = 1.40
      assert.equal(e2eAnalyst.weightMultiplier, 1.4);
    });

    globalThis.fetch = originalFetch;
  });

  await describe("lib/dashboard-stats - simulated bankroll and streak", async () => {
    const base = {
      category: "audit",
      sportType: "crypto",
      title: "t",
      content: "c",
      analyst: "@A",
      target: "SUI",
      pick: "LONG",
      odds: "+100",
      stake: 100,
      confidence: 3,
      dateStr: "Oct 1",
      writeStatus: "local-demo",
    };

    const rec = (id, outcome, pnl, timestamp, stake = 100, blobId) => ({
      ...base,
      id,
      outcome,
      pnl,
      stake,
      timestamp,
      credibilityDelta: 0,
      blobId,
    });

    await it("streak is 0, 2, 3, 5 and resets after a newer loss", () => {
      assert.equal(currentWinStreak([]), 0);
      assert.equal(currentWinStreak([rec("a", "ACCURATE", 10, 2), rec("b", "ACCURATE", 10, 1)]), 2);
      assert.equal(
        currentWinStreak([
          rec("a", "ACCURATE", 10, 3),
          rec("b", "ACCURATE", 10, 2),
          rec("c", "ACCURATE", 10, 1),
        ]),
        3
      );
      assert.equal(
        currentWinStreak([
          rec("a", "ACCURATE", 10, 5),
          rec("b", "ACCURATE", 10, 4),
          rec("c", "ACCURATE", 10, 3),
          rec("d", "ACCURATE", 10, 2),
          rec("e", "ACCURATE", 10, 1),
        ]),
        5
      );
      assert.equal(
        currentWinStreak([
          rec("loss", "FAILED", -10, 9),
          rec("a", "ACCURATE", 10, 5),
          rec("b", "ACCURATE", 10, 4),
        ]),
        0
      );
    });

    await it("activeRisk sums only PENDING stakes", () => {
      const rows = [
        rec("p1", "PENDING", 0, 1, 250),
        rec("p2", "PENDING", 0, 2, 150),
        rec("w", "ACCURATE", 80, 3, 400),
      ];
      assert.equal(activeRisk(rows), 400);
    });

    await it("balance is starting bankroll plus resolved pnl only", () => {
      const rows = [
        rec("w", "ACCURATE", 200, 2),
        rec("l", "FAILED", -50, 1),
        rec("p", "PENDING", 999, 3),
      ];
      assert.equal(simulatedBalance(rows), SIMULATED_STARTING_BANKROLL + 150);
    });

    await it("empty records do not invent numbers", () => {
      assert.equal(currentWinStreak([]), 0);
      assert.equal(activeRisk([]), 0);
      assert.equal(simulatedBalance([]), SIMULATED_STARTING_BANKROLL);
      assert.equal(countOnChainBlobs([]), 0);
    });

    await it("on-chain blob count ignores records without blobId", () => {
      const rows = [
        rec("a", "ACCURATE", 10, 1, 100, "blob-real"),
        rec("b", "PENDING", 0, 2),
        rec("c", "FAILED", -10, 3, 100, ""),
      ];
      assert.equal(countOnChainBlobs(rows), 1);
    });

    await it("isBacktestRecord classifies historical seeds vs live forecasts accurately", () => {
      // Historical seeds rec-01 to rec-16
      assert.equal(isBacktestRecord({ id: "rec-01", source: "walrus" }), true);
      assert.equal(isBacktestRecord({ id: "rec-16", source: "walrus" }), true);
      assert.equal(isBacktestRecord({ id: "rec-07" }), true);

      // Old live forecasts generated with timestamp
      assert.equal(isBacktestRecord({ id: "rec-1730000000000", source: "walrus" }), false);
      assert.equal(isBacktestRecord({ id: "rec-1730999999999" }), false);

      // New live forecasts with live- prefix
      assert.equal(isBacktestRecord({ id: "live-xyz123", source: "walrus" }), false);
      assert.equal(isBacktestRecord({ id: "live-1730000000000" }), false);

      // Source demo is always historical
      assert.equal(isBacktestRecord({ id: "live-local", source: "demo" }), true);
      assert.equal(isBacktestRecord({ id: "custom-id", source: "demo" }), true);
    });

    await it("countLiveVsBacktest returns correct counts for mixed datasets", () => {
      const mixed = [
        { id: "rec-01", source: "walrus" },
        { id: "rec-02", source: "walrus" },
        { id: "rec-1730000000000", source: "walrus" },
        { id: "rec-1730000000001", source: "walrus" },
        { id: "live-alpha", source: "walrus" },
        { id: "rec-legacy-demo", source: "demo" },
      ];
      const counts = countLiveVsBacktest(mixed);
      // Historical: rec-01, rec-02, rec-legacy-demo (3)
      // Live: rec-1730000000000, rec-1730000000001, live-alpha (3)
      assert.equal(counts.backtest, 3);
      assert.equal(counts.live, 3);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 9: Sports Fixture Parsing, Market Settle & Auto-Resolve Invariants
  // --------------------------------------------------------------------------
  await describe("ESPN Fixtures, Sports Market Settlement & Auto-Resolve", async () => {
    const { GET: getFixturesRoute } = await import("../app/api/fixtures/route.ts");
    const { POST: postMemory } = await import("../app/api/memories/route.ts");

    await it("validateLogoUrl strictly allows only https://a.espncdn.com", () => {
      assert.equal(
        validateLogoUrl("https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png"),
        "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png"
      );
      assert.equal(validateLogoUrl("http://a.espncdn.com/insecure.png"), null); // HTTP disallowed
      assert.equal(validateLogoUrl("https://evil.com/fake.png"), null); // Foreign host disallowed
      assert.equal(validateLogoUrl("https://a.espncdn.com.attacker.com/logo.png"), null);
      assert.equal(validateLogoUrl(""), null);
      assert.equal(validateLogoUrl(null), null);
    });

    await it("parseEspnEvent tolerantly parses valid future games and rejects past/near-kickoff", () => {
      const fixedNow = 1730000000000; // Reference time
      const validFutureKickoff = new Date(fixedNow + 2 * 3600 * 1000).toISOString(); // +2 hours

      const mockEvent = {
        id: "401909896",
        date: validFutureKickoff,
        status: { type: { state: "pre" } },
        competitions: [
          {
            venue: { fullName: "Delta Center" },
            competitors: [
              {
                homeAway: "home",
                team: {
                  id: "26",
                  displayName: "Utah Jazz",
                  shortDisplayName: "Jazz",
                  abbreviation: "UTA",
                  logo: "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png",
                },
              },
              {
                homeAway: "away",
                team: {
                  id: "22",
                  displayName: "Portland Trail Blazers",
                  shortDisplayName: "Blazers",
                  abbreviation: "POR",
                  logo: "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/por.png",
                },
              },
            ],
          },
        ],
      };

      const parsed = parseEspnEvent(mockEvent, "nba", "nba", "NBA", fixedNow);
      assert.notEqual(parsed, null);
      assert.equal(parsed?.eventId, "401909896");
      assert.equal(parsed?.home.name, "Utah Jazz");
      assert.equal(parsed?.away.name, "Portland Trail Blazers");
      assert.equal(parsed?.home.logo, "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png");
      assert.equal(parsed?.venue, "Delta Center");

      // Reject games within 10 minutes or past
      const pastKickoff = new Date(fixedNow + 5 * 60 * 1000).toISOString(); // only +5 min
      const pastEvent = { ...mockEvent, date: pastKickoff };
      assert.equal(parseEspnEvent(pastEvent, "nba", "nba", "NBA", fixedNow), null);

      // Reject non-pre status (in-progress or final)
      const inProgressEvent = { ...mockEvent, status: { type: { state: "in" } } };
      assert.equal(parseEspnEvent(inProgressEvent, "nba", "nba", "NBA", fixedNow), null);

      // Reject malformed or missing competitors without crashing
      assert.equal(parseEspnEvent({}, "nba", "nba", "NBA", fixedNow), null);
      assert.equal(parseEspnEvent({ id: "123" }, "nba", "nba", "NBA", fixedNow), null);
    });

    await it("GET /api/fixtures validates query parameters strictly", async () => {
      // Invalid sport
      const res1 = await getFixturesRoute(new Request("http://localhost:3000/api/fixtures?sport=baseball"));
      assert.equal(res1.status, 400);

      // Invalid league for sport
      const res2 = await getFixturesRoute(new Request("http://localhost:3000/api/fixtures?sport=nba&league=eng.1"));
      assert.equal(res2.status, 400);

      // Invalid days
      const res3 = await getFixturesRoute(new Request("http://localhost:3000/api/fixtures?sport=soccer&league=eng.1&days=99"));
      assert.equal(res3.status, 400);
    });

    await it("settleMarket evaluates moneyline and total correctly", () => {
      // Soccer Moneyline: Home Win
      assert.equal(settleMarket({ type: "moneyline", selection: "home" }, { home: 2, away: 1 }), "ACCURATE");
      assert.equal(settleMarket({ type: "moneyline", selection: "away" }, { home: 2, away: 1 }), "FAILED");
      assert.equal(settleMarket({ type: "moneyline", selection: "draw" }, { home: 2, away: 1 }), "FAILED");

      // Soccer Moneyline: Draw
      assert.equal(settleMarket({ type: "moneyline", selection: "draw" }, { home: 1, away: 1 }), "ACCURATE");
      assert.equal(settleMarket({ type: "moneyline", selection: "home" }, { home: 1, away: 1 }), "FAILED");

      // Total Over/Under with valid half-line
      assert.equal(settleMarket({ type: "total", selection: "over", line: 2.5 }, { home: 2, away: 1 }), "ACCURATE"); // 3 > 2.5
      assert.equal(settleMarket({ type: "total", selection: "under", line: 2.5 }, { home: 2, away: 1 }), "FAILED");
      assert.equal(settleMarket({ type: "total", selection: "under", line: 3.5 }, { home: 2, away: 1 }), "ACCURATE");

      // Strict rejection of integer line (disallowed to prevent push)
      assert.equal(settleMarket({ type: "total", selection: "over", line: 3.0 }, { home: 2, away: 1 }), "manual_required");
    });

    await it("memory codec preserves and round-trips structured fixture and market", () => {
      const sportsPayload = {
        version: "1.0",
        type: "prediction",
        predictionId: "rec-sports-01",
        analyst: "@OptaTactics",
        category: "soccer",
        title: "Arsenal vs Chelsea (Premier League): Arsenal to Win",
        target: "Arsenal vs Chelsea",
        pick: "Arsenal to Win",
        outcome: "PENDING",
        delta: 0,
        resolvedAt: "2026-11-03T20:00:00.000Z",
        fixture: {
          provider: "espn",
          eventId: "700123",
          sport: "soccer",
          league: "eng.1",
          leagueLabel: "Premier League",
          kickoff: "2026-11-03T20:00:00.000Z",
          home: { id: "1", name: "Arsenal", abbr: "ARS", logo: "https://a.espncdn.com/ars.png" },
          away: { id: "2", name: "Chelsea", abbr: "CHE", logo: "https://a.espncdn.com/che.png" },
        },
        market: {
          type: "moneyline",
          selection: "home",
        },
      };

      const encoded = encodeMemory(sportsPayload);
      const decoded = decodeMemory(encoded);
      assert.notEqual(decoded, null);
      assert.equal(decoded?.fixture?.eventId, "700123");
      assert.equal(decoded?.fixture?.home.name, "Arsenal");
      assert.equal(decoded?.market?.selection, "home");

      const record = payloadToPredictionRecord(decoded, "blob-sports-01");
      assert.equal(record.fixture?.eventId, "700123");
      assert.equal(record.market?.type, "moneyline");

      // Deduplication retains fixture and market when merging pending with resolved
      const resolvedClone = { ...record, outcome: "ACCURATE", credibilityDelta: 7, pnl: 227 };
      delete resolvedClone.fixture; // Suppose resolved receipt omits fixture
      const merged = dedupePredictions([record, resolvedClone]);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].outcome, "ACCURATE");
      assert.equal(merged[0].fixture?.eventId, "700123"); // Preserved from pending!
    });

    await it("POST /api/memories accepts structured sports forecasts and creates server-curated target/pick", async () => {
      // Mock getVerifiedFixtureById for offline testing
      const futureKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("site.api.espn.com")) {
          return {
            ok: true,
            json: async () => ({
              events: [
                {
                  id: "mock_event_999",
                  date: futureKickoff,
                  status: { type: { state: "pre" } },
                  competitions: [
                    {
                      competitors: [
                        { homeAway: "home", team: { id: "1", displayName: "Arsenal", shortDisplayName: "Arsenal", abbreviation: "ARS" } },
                        { homeAway: "away", team: { id: "2", displayName: "Liverpool", shortDisplayName: "Liverpool", abbreviation: "LIV" } },
                      ],
                    },
                  ],
                },
              ],
            }),
          };
        }
        return originalFetch(url);
      };

      const validSportsBody = {
        analyst: "@StatmanDaveFC",
        sportType: "soccer",
        stake: 300,
        confidence: 4,
        odds: "-110",
        target: "Client Injected Fake Target", // Should be overwritten by server
        pick: "Client Injected Fake Pick",     // Should be overwritten by server
        fixture: {
          provider: "espn",
          eventId: "mock_event_999",
          sport: "soccer",
          league: "eng.1",
          leagueLabel: "Premier League",
          kickoff: futureKickoff,
          home: { id: "1", name: "Arsenal" },
          away: { id: "2", name: "Liverpool" },
        },
        market: {
          type: "moneyline",
          selection: "home",
        },
      };

      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSportsBody),
      });

      const res = await postMemory(req);
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.success, true);
      assert.equal(json.data.target, "Arsenal vs Liverpool"); // Server overwritten!
      assert.equal(json.data.pick, "Arsenal to Win"); // Server overwritten!
      assert.equal(json.data.fixture?.eventId, "mock_event_999");

      globalThis.fetch = originalFetch;
    });

    await it("POST /api/memories rejects total line that is not a half-number (x.5)", async () => {
      const originalFetch = globalThis.fetch;
      const futureKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("site.api.espn.com")) {
          return {
            ok: true,
            json: async () => ({
              events: [
                {
                  id: "mock_event_999",
                  date: futureKickoff,
                  status: { type: { state: "pre" } },
                  competitions: [
                    {
                      competitors: [
                        { homeAway: "home", team: { id: "1", displayName: "Arsenal" } },
                        { homeAway: "away", team: { id: "2", displayName: "Liverpool" } },
                      ],
                    },
                  ],
                },
              ],
            }),
          };
        }
        return originalFetch(url);
      };

      const badLineBody = {
        analyst: "@StatmanDaveFC",
        sportType: "soccer",
        stake: 300,
        confidence: 4,
        target: "Arsenal vs Liverpool",
        pick: "Over 3 Goals",
        fixture: {
          provider: "espn",
          eventId: "mock_event_999",
          sport: "soccer",
          league: "eng.1",
          kickoff: futureKickoff,
          home: { id: "1", name: "Arsenal" },
          away: { id: "2", name: "Liverpool" },
        },
        market: {
          type: "total",
          selection: "over",
          line: 3.0, // Integer line rejected!
        },
      };

      const req = new Request("http://localhost:3000/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badLineBody),
      });

      const res = await postMemory(req);
      const json = await res.json();
      assert.equal(res.status, 400);
      assert.equal(json.success, false);
      assert.ok(json.error?.includes("half-number"));

      globalThis.fetch = originalFetch;
    });

    await it("resolveDuePredictions: ENABLE_SPORTS_AUTORESOLVE=false keeps sports in manual_required", async () => {
      process.env.ENABLE_SPORTS_AUTORESOLVE = "false";

      const candidateSports = [
        {
          id: "rec-sports-manual-test",
          category: "prediction",
          sportType: "soccer",
          title: "Arsenal vs Liverpool",
          target: "Arsenal vs Liverpool",
          pick: "Arsenal to Win",
          analyst: "@Sharps",
          odds: "-110",
          stake: 250,
          pnl: 0,
          outcome: "PENDING",
          credibilityDelta: 0,
          confidence: 4,
          timestamp: Date.now() - 3600000,
          dateStr: "Nov 1",
          writeStatus: "confirmed",
          deadline: new Date(Date.now() - 3600000).toISOString(),
          fixture: {
            provider: "espn",
            eventId: "7001",
            sport: "soccer",
            league: "eng.1",
            leagueLabel: "Premier League",
            kickoff: new Date(Date.now() - 3600000).toISOString(),
            home: { id: "1", name: "Arsenal" },
            away: { id: "2", name: "Liverpool" },
          },
          market: {
            type: "moneyline",
            selection: "home",
          },
        },
      ];

      const res = await resolveDuePredictions(candidateSports);
      assert.equal(res.resolvedCount, 0);
      assert.equal(res.results[0].status, "manual_required");
      assert.ok(res.results[0].reason?.includes("manual") || res.results[0].reason?.includes("Sports fixtures"));
    });

    await it("resolveDuePredictions: ENABLE_SPORTS_AUTORESOLVE=true resolves completed match via ESPN", async () => {
      process.env.ENABLE_SPORTS_AUTORESOLVE = "true";

      const kickoffPast = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (url) => {
        if (typeof url === "string" && url.includes("site.api.espn.com")) {
          return {
            ok: true,
            json: async () => ({
              events: [
                {
                  id: "7002",
                  status: {
                    type: {
                      state: "post",
                      completed: true,
                      name: "STATUS_FINAL",
                      description: "Final",
                    },
                  },
                  competitions: [
                    {
                      competitors: [
                        { homeAway: "home", score: "3" }, // Arsenal 3
                        { homeAway: "away", score: "1" }, // Liverpool 1
                      ],
                    },
                  ],
                },
              ],
            }),
          };
        }
        return originalFetch(url);
      };

      const candidateSports = [
        {
          id: "rec-sports-autoresolve-live-01",
          category: "prediction",
          sportType: "soccer",
          title: "Arsenal vs Liverpool",
          target: "Arsenal vs Liverpool",
          pick: "Arsenal to Win",
          analyst: "@Sharps",
          odds: "-110",
          stake: 250,
          pnl: 0,
          outcome: "PENDING",
          credibilityDelta: 0,
          confidence: 4,
          timestamp: Date.now() - 7200000,
          dateStr: "Nov 1",
          writeStatus: "confirmed",
          deadline: kickoffPast,
          fixture: {
            provider: "espn",
            eventId: "7002",
            sport: "soccer",
            league: "eng.1",
            leagueLabel: "Premier League",
            kickoff: kickoffPast,
            home: { id: "1", name: "Arsenal" },
            away: { id: "2", name: "Liverpool" },
          },
          market: {
            type: "moneyline",
            selection: "home",
          },
        },
      ];

      const res = await resolveDuePredictions(candidateSports);
      assert.equal(res.resolvedCount, 1);
      assert.equal(res.results[0].status, "resolved");
      assert.equal(res.results[0].outcome, "ACCURATE"); // Home won 3-1!
      assert.equal(res.results[0].evidence?.source, "espn-scoreboard (unofficial)");
      assert.ok(!res.results[0].evidence?.details?.includes("Tatum")); // Non-Tatum honest attribution

      process.env.ENABLE_SPORTS_AUTORESOLVE = "false";
      globalThis.fetch = originalFetch;
    });
  });

  console.log("\n=================================================");
  console.log(`  FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL TEST HARNESS ERROR:", e);
  process.exit(1);
});
