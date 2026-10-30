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

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

function describe(title, fn) {
  console.log(`\n[SUITE] ${title}`);
  fn();
}

console.log("=================================================");
console.log("  ALPHARECALL UNIT TESTS (VITEST RUNNER COMPAT)  ");
console.log("=================================================");

describe("lib/memory-codec - Encode & Decode Validation", () => {
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

  it("should encode memory payload with ALPHARECALL_V1 prefix", () => {
    const encoded = encodeMemory(samplePayload);
    assert.equal(encoded.startsWith(MEMORY_PREFIX), true);
    assert.equal(encoded.includes('"predictionId":"rec-test-01"'), true);
    assert.equal(encoded.includes('"analyst":"@OptaTactics"'), true);
  });

  it("should successfully roundtrip encode and decode without data loss", () => {
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

  it("should reject corrupted, missing, or un-prefixed inputs", () => {
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

  it("should convert PredictionRecord to payload and back faithfully", () => {
    const record = {
      id: "rec-test-02",
      category: "audit",
      sportType: "nba",
      title: "Celtics vs Bucks",
      content: "BOS vs MIL: BOS -9.5 (ACCURATE)",
      analyst: "@HoopSharpsNBA",
      target: "BOS vs MIL",
      pick: "BOS -9.5",
      odds: "-110",
      stake: 300,
      pnl: 272,
      outcome: "ACCURATE",
      credibilityDelta: 6,
      confidence: 4,
      timestamp: 1730142000000,
      dateStr: "Oct 28",
      writeStatus: "confirmed",
      blobId: "walrus_blob_test_123",
      source: "walrus",
    };

    const payload = predictionRecordToPayload(record);
    assert.equal(payload.predictionId, "rec-test-02");
    assert.equal(payload.delta, 6);

    const reconverted = payloadToPredictionRecord(payload, record.blobId);
    assert.equal(reconverted.id, record.id);
    assert.equal(reconverted.analyst, record.analyst);
    assert.equal(reconverted.blobId, "walrus_blob_test_123");
    assert.equal(reconverted.writeStatus, "confirmed");
  });
});

describe("lib/credibility - computeWeight Boundary Tests", () => {
  it("should return baseline 1.0 when delta is 0", () => {
    assert.equal(computeWeight(0), 1.0);
  });

  it("should scale up linearly with positive deltas (1.0 + delta / 20)", () => {
    assert.equal(computeWeight(10), 1.5);
    assert.equal(computeWeight(20), 2.0);
    assert.equal(computeWeight(24), 2.2);
  });

  it("should strictly clamp at MAX_CREDIBILITY_WEIGHT (2.40)", () => {
    assert.equal(computeWeight(28), MAX_CREDIBILITY_WEIGHT);
    assert.equal(computeWeight(100), MAX_CREDIBILITY_WEIGHT);
    assert.equal(computeWeight(9999), MAX_CREDIBILITY_WEIGHT);
  });

  it("should scale down with negative deltas", () => {
    assert.equal(computeWeight(-6), 0.7);
    assert.equal(computeWeight(-10), 0.5);
  });

  it("should strictly clamp at lower bound MIN_CREDIBILITY_WEIGHT (0.40)", () => {
    assert.equal(computeWeight(-12), 0.4);
    assert.equal(computeWeight(-20), MIN_CREDIBILITY_WEIGHT);
    assert.equal(computeWeight(-100), MIN_CREDIBILITY_WEIGHT);
  });

  it("should handle NaN gracefully", () => {
    assert.equal(computeWeight(NaN), 1.0);
  });
});

describe("lib/credibility - computeForecasterStats", () => {
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
    {
      id: "3",
      category: "audit",
      sportType: "soccer",
      title: "Match 3",
      content: "",
      analyst: "@Erratic",
      target: "M3",
      pick: "W",
      odds: "+110",
      stake: 100,
      pnl: -100,
      outcome: "FAILED",
      credibilityDelta: -8,
      confidence: 3,
      timestamp: 1500,
      dateStr: "Day 1",
      writeStatus: "local-demo",
    },
  ];

  it("should compute exact win rates, deltas, and weight multipliers", () => {
    const stats = computeForecasterStats(mockPredictions);

    assert.equal(stats.length, 2);

    const sharp = stats.find((s) => s.handle === "@Sharpshooter");
    assert.notEqual(sharp, undefined);
    assert.equal(sharp?.totalPicks, 2);
    assert.equal(sharp?.wins, 2);
    assert.equal(sharp?.losses, 0);
    assert.equal(sharp?.winRate, 100.0);
    assert.equal(sharp?.deltaTotal, 12);
    assert.equal(sharp?.weightMultiplier, 1.6);
    assert.equal(sharp?.netPnl, 180);
    assert.equal(sharp?.verifiedBlobs.length, 2);

    const erratic = stats.find((s) => s.handle === "@Erratic");
    assert.notEqual(erratic, undefined);
    assert.equal(erratic?.wins, 0);
    assert.equal(erratic?.losses, 1);
    assert.equal(erratic?.winRate, 0.0);
    assert.equal(erratic?.deltaTotal, -8);
    assert.equal(erratic?.weightMultiplier, 0.6);
    assert.equal(erratic?.netPnl, -100);
  });
});

describe("lib/credibility - consensus() Evaluation", () => {
  it("should compute identical picks when all weights are 1.0", () => {
    const opinions = [
      { analyst: "@User1", pick: "OVER 2.5", confidence: 3 },
      { analyst: "@User2", pick: "OVER 2.5", confidence: 3 },
      { analyst: "@User3", pick: "UNDER 2.5", confidence: 4 },
    ];

    const weights = {
      "@User1": 1.0,
      "@User2": 1.0,
      "@User3": 1.0,
    };

    const res = consensus("Match X", opinions, weights);
    assert.equal(res.unweightedPick, "OVER 2.5");
    assert.equal(res.weightedPick, "OVER 2.5");
    assert.equal(res.pivoted, false);
    assert.equal(res.confidenceShift, 0);
  });

  it("should dynamically pivot consensus pick when memory downweights bad forecasters and boosts sharps", () => {
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
    assert.equal(res.boostedSharps.includes("@MasterSharp"), true);
    assert.equal(res.dampenedForecasters.includes("@HypeGuy1"), true);
    assert.equal(res.weightedConfidence > res.unweightedConfidence, true);
  });
});

console.log("\n=================================================");
console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log("=================================================\n");

if (failed > 0) {
  process.exit(1);
}
