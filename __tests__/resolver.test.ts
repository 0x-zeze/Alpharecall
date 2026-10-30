import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveCryptoPrediction,
  resolveDuePredictions,
  calculateOutcomeDelta,
  parseCryptoTarget,
} from "../lib/resolver";
import { PredictionRecord } from "../lib/types";

describe("lib/resolver - parseCryptoTarget", () => {
  it("should parse above target correctly", () => {
    const res = parseCryptoTarget("SUI/USDT Spot Breakout", "LONG SUI > $2.00");
    expect(res).not.toBeNull();
    expect(res?.symbol).toBe("sui");
    expect(res?.targetPrice).toBe(2.0);
    expect(res?.direction).toBe("above");
  });

  it("should parse below / short target correctly", () => {
    const res = parseCryptoTarget("ETH/BTC Spot Ratio", "RATIO < 0.0380");
    expect(res).not.toBeNull();
    expect(res?.symbol).toBe("ethereum");
    expect(res?.direction).toBe("below");
  });

  it("should parse 'k' notation targets (e.g. 69k)", () => {
    const res = parseCryptoTarget("BTC/USDT Range Sweep", "BTC TEST $69K");
    expect(res).not.toBeNull();
    expect(res?.symbol).toBe("bitcoin");
    expect(res?.targetPrice).toBe(69000);
  });
});

describe("lib/resolver - calculateOutcomeDelta", () => {
  it("should award higher delta for high confidence wins", () => {
    expect(calculateOutcomeDelta("ACCURATE", 5)).toBe(8);
    expect(calculateOutcomeDelta("ACCURATE", 4)).toBe(6);
    expect(calculateOutcomeDelta("ACCURATE", 2)).toBe(4);
  });

  it("should penalize high confidence misses more harshly", () => {
    expect(calculateOutcomeDelta("FAILED", 5)).toBe(-8);
    expect(calculateOutcomeDelta("FAILED", 3)).toBe(-5);
  });
});

describe("lib/resolver - Mocked Resolver Execution & Idempotency", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TATUM_API_KEY = "mock_tatum_key_12345";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockCryptoPrediction: PredictionRecord = {
    id: "pred-crypto-01",
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
    dateStr: "Oct 27",
    writeStatus: "local-demo",
  };

  it("should resolve ACCURATE when Tatum rate exceeds targetPrice for above condition", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
        return {
          ok: true,
          json: async () => ({ value: "2.36", basePair: "USD" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await resolveCryptoPrediction(mockCryptoPrediction);

    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("ACCURATE");
    expect(result.delta).toBe(8); // High confidence 5 -> +8 delta
    expect(result.evidence?.source).toBe("tatum_data_api");
    expect(result.evidence?.price).toBe(2.36);
  });

  it("should resolve FAILED when Tatum rate falls short of targetPrice", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
        return {
          ok: true,
          json: async () => ({ value: "1.25", basePair: "USD" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await resolveCryptoPrediction(mockCryptoPrediction);

    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("FAILED");
    expect(result.delta).toBe(-8); // High confidence 5 loss -> -8 delta
    expect(result.evidence?.price).toBe(1.25);
  });

  it("should fallback to public oracle when Tatum API returns an error", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.tatum.io")) {
        return {
          ok: false,
          status: 401,
          text: async () => "Unauthorized API Key",
        } as Response;
      }
      if (url.includes("api.coingecko.com")) {
        return {
          ok: true,
          json: async () => ({ sui: { usd: 2.15 } }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const result = await resolveCryptoPrediction(mockCryptoPrediction);

    expect(result.status).toBe("resolved");
    expect(result.outcome).toBe("ACCURATE");
    expect(result.evidence?.source).toBe("coingecko_public_fallback");
    expect(result.evidence?.price).toBe(2.15);
  });

  it("should strictly respect idempotency: second pass skips already-settled predictions", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.tatum.io/v3/tatum/rate/SUI")) {
        return {
          ok: true,
          json: async () => ({ value: "2.36", basePair: "USD" }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    // Run 1: resolves the prediction
    const report1 = await resolveDuePredictions([mockCryptoPrediction]);
    expect(report1.resolvedCount).toBe(1);

    // Run 2: same prediction must be skipped idempotently!
    const report2 = await resolveDuePredictions([mockCryptoPrediction]);
    expect(report2.resolvedCount).toBe(0);
    expect(report2.skippedCount).toBe(1);
    expect(report2.results[0].status).toBe("skipped");
  });
});
