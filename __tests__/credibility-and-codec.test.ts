import { describe, it, expect } from "vitest";
import {
  encodeMemory,
  decodeMemory,
  payloadToPredictionRecord,
  predictionRecordToPayload,
  MemoryPayloadV1,
  MEMORY_PREFIX,
} from "../lib/memory-codec";
import {
  computeWeight,
  computeForecasterStats,
  consensus,
  MIN_CREDIBILITY_WEIGHT,
  MAX_CREDIBILITY_WEIGHT,
} from "../lib/credibility";
import { PredictionRecord } from "../lib/types";

describe("lib/memory-codec - Encode & Decode Validation", () => {
  const samplePayload: MemoryPayloadV1 = {
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
    expect(encoded.startsWith(MEMORY_PREFIX)).toBe(true);
    expect(encoded).toContain('"predictionId":"rec-test-01"');
    expect(encoded).toContain('"analyst":"@OptaTactics"');
  });

  it("should successfully roundtrip encode and decode without data loss", () => {
    const encoded = encodeMemory(samplePayload);
    const decoded = decodeMemory(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.predictionId).toBe(samplePayload.predictionId);
    expect(decoded?.analyst).toBe(samplePayload.analyst);
    expect(decoded?.category).toBe(samplePayload.category);
    expect(decoded?.pick).toBe(samplePayload.pick);
    expect(decoded?.outcome).toBe(samplePayload.outcome);
    expect(decoded?.delta).toBe(samplePayload.delta);
    expect(decoded?.stake).toBe(samplePayload.stake);
    expect(decoded?.pnl).toBe(samplePayload.pnl);
    expect(decoded?.resolvedAt).toBe(samplePayload.resolvedAt);
    expect(decoded?.evidence?.score).toBe("0-4");
  });

  it("should reject corrupted, missing, or un-prefixed inputs", () => {
    // Missing prefix
    expect(decodeMemory('{"predictionId":"123"}')).toBeNull();

    // Plain text without prefix
    expect(decodeMemory("Just some random text")).toBeNull();

    // Empty or null
    expect(decodeMemory("")).toBeNull();
    expect(decodeMemory(null)).toBeNull();
    expect(decodeMemory(undefined)).toBeNull();

    // Malformed JSON after prefix
    expect(decodeMemory(`${MEMORY_PREFIX}{malformed_json:`)).toBeNull();

    // Missing required fields (e.g. missing target and pick)
    expect(decodeMemory(`${MEMORY_PREFIX}{"predictionId":"1","analyst":"@test"}`)).toBeNull();

    // Invalid outcome
    const invalidOutcome = { ...samplePayload, outcome: "INVALID_STATUS" as any };
    expect(decodeMemory(`${MEMORY_PREFIX}${JSON.stringify(invalidOutcome)}`)).toBeNull();
  });

  it("should convert PredictionRecord to payload and back faithfully", () => {
    const record: PredictionRecord = {
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
    expect(payload.predictionId).toBe("rec-test-02");
    expect(payload.delta).toBe(6);

    const reconverted = payloadToPredictionRecord(payload, record.blobId);
    expect(reconverted.id).toBe(record.id);
    expect(reconverted.analyst).toBe(record.analyst);
    expect(reconverted.blobId).toBe("walrus_blob_test_123");
    expect(reconverted.writeStatus).toBe("confirmed");
  });
});

describe("lib/credibility - computeWeight Boundary Tests", () => {
  it("should return baseline 1.0 when delta is 0", () => {
    expect(computeWeight(0)).toBe(1.0);
  });

  it("should scale up linearly with positive deltas (1.0 + delta / 20)", () => {
    expect(computeWeight(10)).toBe(1.5);
    expect(computeWeight(20)).toBe(2.0);
    expect(computeWeight(24)).toBe(2.2);
  });

  it("should strictly clamp at MAX_CREDIBILITY_WEIGHT (2.40)", () => {
    expect(computeWeight(28)).toBe(MAX_CREDIBILITY_WEIGHT);
    expect(computeWeight(100)).toBe(MAX_CREDIBILITY_WEIGHT);
    expect(computeWeight(9999)).toBe(MAX_CREDIBILITY_WEIGHT);
  });

  it("should scale down with negative deltas", () => {
    expect(computeWeight(-6)).toBe(0.7);
    expect(computeWeight(-10)).toBe(0.5);
  });

  it("should strictly clamp at lower bound MIN_CREDIBILITY_WEIGHT (0.40)", () => {
    expect(computeWeight(-12)).toBe(0.4);
    expect(computeWeight(-20)).toBe(MIN_CREDIBILITY_WEIGHT);
    expect(computeWeight(-100)).toBe(MIN_CREDIBILITY_WEIGHT);
  });

  it("should handle NaN gracefully", () => {
    expect(computeWeight(NaN)).toBe(1.0);
  });
});

describe("lib/credibility - computeForecasterStats", () => {
  const mockPredictions: PredictionRecord[] = [
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

    expect(stats.length).toBe(2);

    const sharp = stats.find((s) => s.handle === "@Sharpshooter");
    expect(sharp).toBeDefined();
    expect(sharp?.totalPicks).toBe(2);
    expect(sharp?.wins).toBe(2);
    expect(sharp?.losses).toBe(0);
    expect(sharp?.winRate).toBe(100.0);
    expect(sharp?.deltaTotal).toBe(12);
    expect(sharp?.weightMultiplier).toBe(1.6); // 1.0 + 12/20 = 1.60
    expect(sharp?.netPnl).toBe(180);
    expect(sharp?.verifiedBlobs.length).toBe(2);

    const erratic = stats.find((s) => s.handle === "@Erratic");
    expect(erratic).toBeDefined();
    expect(erratic?.wins).toBe(0);
    expect(erratic?.losses).toBe(1);
    expect(erratic?.winRate).toBe(0.0);
    expect(erratic?.deltaTotal).toBe(-8);
    expect(erratic?.weightMultiplier).toBe(0.6); // 1.0 - 8/20 = 0.60
    expect(erratic?.netPnl).toBe(-100);
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
    expect(res.unweightedPick).toBe("OVER 2.5");
    expect(res.weightedPick).toBe("OVER 2.5");
    expect(res.pivoted).toBe(false);
    expect(res.confidenceShift).toBe(0);
  });

  it("should dynamically pivot consensus pick when memory downweights bad forecasters and boosts sharps", () => {
    // 2 weak analysts pick "FAVORITE -1.5", 1 sharp analyst picks "UNDERDOG +1.5"
    const opinions = [
      { analyst: "@HypeGuy1", pick: "FAVORITE -1.5", confidence: 3 },
      { analyst: "@HypeGuy2", pick: "FAVORITE -1.5", confidence: 3 },
      { analyst: "@MasterSharp", pick: "UNDERDOG +1.5", confidence: 4 },
    ];

    // Unweighted score: FAVORITE = 3 + 3 = 6.0; UNDERDOG = 4.0 -> FAVORITE wins unweighted!
    // But @HypeGuy1 & 2 are penalized to 0.4x by past losses, and @MasterSharp is boosted to 2.2x:
    const weights = {
      "@HypeGuy1": 0.4,
      "@HypeGuy2": 0.4,
      "@MasterSharp": 2.2,
    };

    // Weighted score: FAVORITE = (3 * 0.4) + (3 * 0.4) = 2.40; UNDERDOG = 4 * 2.2 = 8.80!
    // -> UNDERDOG wins overwhelmingly!
    const res = consensus("Derby Fixture", opinions, weights);

    expect(res.unweightedPick).toBe("FAVORITE -1.5");
    expect(res.weightedPick).toBe("UNDERDOG +1.5");
    expect(res.pivoted).toBe(true);
    expect(res.boostedSharps).toContain("@MasterSharp");
    expect(res.dampenedForecasters).toContain("@HypeGuy1");
    expect(res.weightedConfidence).toBeGreaterThan(res.unweightedConfidence);
  });
});
