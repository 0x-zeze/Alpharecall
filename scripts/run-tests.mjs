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
  RESOLVER_GRACE_WINDOW_MS,
} from "../lib/resolver.ts";
import {
  getTatumGatewayStatus,
  getSuiChainMetrics,
  getLatestSuiCheckpointAnchor,
} from "../lib/tatum.ts";
import { dedupePredictions } from "../lib/dedupe.ts";
import { DEMO_PREDICTIONS } from "../lib/demo-data.ts";

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

    await it("should return ok:false and null fields when Sui RPC returns an error or 404", async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 404,
      });

      const chain = await getSuiChainMetrics();
      assert.equal(chain.ok, false);
      assert.equal(chain.status, "unavailable");
      assert.equal(chain.checkpoint, null);
      assert.equal(chain.epoch, null);
      assert.equal(chain.referenceGasPrice, null);
    });

    await it("should gracefully return null checkpoint anchor when RPC fails during prediction intake", async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 503,
      });

      const anchor = await getLatestSuiCheckpointAnchor();
      assert.equal(anchor.checkpoint, null);
      assert.equal(anchor.digest, null);
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
