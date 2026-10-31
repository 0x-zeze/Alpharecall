import type { TatumGatewayStatus, SuiChainStatus, SuiNodeStatus } from "./types";

/**
 * Fetch live Tatum API Gateway metadata (Plan, Credits, Latency, Version).
 * Strictly authentic telemetry from https://api.tatum.io/v3/tatum/version.
 * No hardcoded defaults or fabricated credit counts.
 */
export async function getTatumGatewayStatus(): Promise<TatumGatewayStatus> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const startTime = Date.now();

  const isTatumConfigured = Boolean(
    tatumApiKey &&
    tatumApiKey !== "your_tatum_api_key_here" &&
    !tatumApiKey.startsWith("your_")
  );

  if (!isTatumConfigured || !tatumApiKey) {
    return {
      ok: false,
      status: "unavailable",
      plan: null,
      creditLimit: null,
      usage: null,
      latencyMs: null,
      version: null,
      error: "TATUM_API_KEY is not configured.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch("https://api.tatum.io/v3/tatum/version", {
      headers: { "x-api-key": tatumApiKey },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - startTime;

    return {
      ok: true,
      status: "live",
      plan: data?.planName ?? null,
      creditLimit: typeof data?.creditLimit === "number" ? data.creditLimit : null,
      usage: typeof data?.usage === "number" ? data.usage : null,
      latencyMs,
      version: data?.version ? `v${data.version}` : null,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : "Tatum Gateway unreachable";
    return {
      ok: false,
      status: "unavailable",
      plan: null,
      creditLimit: null,
      usage: null,
      latencyMs: null,
      version: null,
      error: `Tatum Gateway error: ${msg}`,
    };
  }
}

/**
 * Fetch live Sui Network chain metrics via Tatum Sui Gateway.
 * Queries sui_getLatestCheckpointSequenceNumber, sui_getCheckpoint, suix_getReferenceGasPrice,
 * and suix_getLatestSuiSystemState.
 *
 * Strict Honesty Invariant:
 * If the Tatum Gateway returns 404, or if JSON-RPC is deprecated on the target node,
 * this function returns ok: false, status: "unavailable", with all chain fields as null.
 * NO fabricated checkpoints, NO hardcoded epochs, and NEVER places coin prices into checkpoint fields.
 */
export async function getSuiChainMetrics(): Promise<SuiChainStatus> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const startTime = Date.now();

  const isTatumConfigured = Boolean(
    tatumApiKey &&
    tatumApiKey !== "your_tatum_api_key_here" &&
    !tatumApiKey.startsWith("your_")
  );

  const rpcUrl = "https://sui-mainnet.gateway.tatum.io";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isTatumConfigured && tatumApiKey) {
    headers["x-api-key"] = tatumApiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    // 1. Fetch latest checkpoint sequence
    const checkpointRes = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!checkpointRes.ok) {
      let bodySnippet = "";
      try {
        const text = await checkpointRes.text();
        const cleaned = text.replace(/\s+/g, " ").trim();
        if (cleaned) {
          bodySnippet = cleaned.slice(0, 200);
        }
      } catch {
        bodySnippet = "";
      }

      const detail = bodySnippet ? `: ${bodySnippet}` : "";
      throw new Error(`HTTP ${checkpointRes.status} from ${rpcUrl}${detail}`);
    }

    const checkpointData = await checkpointRes.json();
    if (checkpointData?.error) {
      throw new Error(checkpointData.error.message || "RPC returned error");
    }

    const checkpoint = checkpointData?.result ? String(checkpointData.result) : null;
    let checkpointDigest: string | null = null;

    // 2. Fetch checkpoint details (for digest)
    if (checkpoint) {
      try {
        const detailRes = await fetch(rpcUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "sui_getCheckpoint",
            params: [checkpoint],
          }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          if (detailData?.result?.digest) {
            checkpointDigest = String(detailData.result.digest);
          }
        }
      } catch {
        checkpointDigest = null;
      }
    }

    // 3. Fetch reference gas price
    let referenceGasPrice: string | null = null;
    try {
      const gasRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "suix_getReferenceGasPrice",
          params: [],
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (gasRes.ok) {
        const gasData = await gasRes.json();
        if (gasData?.result) {
          referenceGasPrice = `${gasData.result} MIST`;
        }
      }
    } catch {
      referenceGasPrice = null;
    }

    // 4. Fetch real epoch from suix_getLatestSuiSystemState (never hardcode!)
    let epoch: string | null = null;
    try {
      const systemStateRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "suix_getLatestSuiSystemState",
          params: [],
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (systemStateRes.ok) {
        const stateData = await systemStateRes.json();
        if (stateData?.result?.epoch) {
          epoch = String(stateData.result.epoch);
        }
      }
    } catch {
      epoch = null;
    }

    // 5. Fetch chain identifier
    let chainId: string | null = null;
    try {
      const chainRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "sui_getChainIdentifier",
          params: [],
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (chainRes.ok) {
        const chainData = await chainRes.json();
        if (chainData?.result) {
          chainId = String(chainData.result);
        }
      }
    } catch {
      chainId = null;
    }

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    return {
      ok: true,
      status: "live",
      checkpoint,
      checkpointDigest,
      epoch,
      referenceGasPrice,
      chainId,
      latencyMs,
      rpcUrl: "sui-mainnet.gateway.tatum.io",
      isTatumGateway: isTatumConfigured,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : "Sui RPC unreachable";
    return {
      ok: false,
      status: "unavailable",
      checkpoint: null,
      checkpointDigest: null,
      epoch: null,
      referenceGasPrice: null,
      chainId: null,
      latencyMs: null,
      rpcUrl: "sui-mainnet.gateway.tatum.io",
      isTatumGateway: isTatumConfigured,
      error: `Sui RPC unavailable: ${msg}`,
    };
  }
}

/**
 * Helper used during prediction creation to anchor the latest Sui Checkpoint.
 * If the Sui RPC is unavailable or returns an error, returns null values gracefully.
 * Never throws and never blocks prediction creation.
 */
export async function getLatestSuiCheckpointAnchor(): Promise<{
  checkpoint: string | null;
  digest: string | null;
}> {
  try {
    const chainMetrics = await getSuiChainMetrics();
    if (chainMetrics.ok && chainMetrics.checkpoint) {
      return {
        checkpoint: chainMetrics.checkpoint,
        digest: chainMetrics.checkpointDigest,
      };
    }
  } catch {
    // Non-blocking fallback
  }
  return {
    checkpoint: null,
    digest: null,
  };
}

/**
 * Backward-compatible composite status for existing UI components.
 */
export async function getSuiMetrics(): Promise<SuiNodeStatus> {
  const chainMetrics = await getSuiChainMetrics();
  return {
    ...chainMetrics,
    errorMessage: chainMetrics.error || undefined,
  };
}

/**
 * Fetch real-time cryptocurrency exchange rate from Tatum Data API.
 * Endpoint: https://api.tatum.io/v3/tatum/rate/{symbol}?basePair={basePair}
 * with x-api-key header.
 */
export async function getTatumCryptoRate(
  symbol: string,
  basePair = "USD"
): Promise<{ ok: boolean; rate?: number; source?: string; error?: string }> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const isTatumConfigured = Boolean(
    tatumApiKey &&
    tatumApiKey !== "your_tatum_api_key_here" &&
    !tatumApiKey.startsWith("your_")
  );

  if (!isTatumConfigured || !tatumApiKey) {
    return {
      ok: false,
      error: "TATUM_API_KEY not configured. Cannot query Tatum Data API.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://api.tatum.io/v3/tatum/rate/${symbol.toUpperCase()}?basePair=${basePair}`,
      {
        headers: {
          "x-api-key": tatumApiKey,
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Tatum Rate API HTTP ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    const rateVal = parseFloat(data.value);
    if (isNaN(rateVal)) {
      return { ok: false, error: "Tatum Rate API returned non-numeric value" };
    }

    return {
      ok: true,
      rate: rateVal,
      source: "tatum_data_api",
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fallback public price oracle (CoinGecko).
 * Strictly guarded: only invoked when ALLOW_PUBLIC_ORACLE_FALLBACK === "true".
 * Explicitly records source as fallback oracle.
 */
export async function getFallbackCryptoRate(
  symbol: "sui" | "bitcoin" | "ethereum"
): Promise<{ ok: boolean; rate?: number; source?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `Fallback oracle returned status ${res.status}` };
    }
    const data = await res.json();
    const price = data?.[symbol]?.usd;
    if (typeof price !== "number") {
      return { ok: false, error: "Price missing from fallback oracle" };
    }
    return {
      ok: true,
      rate: price,
      source: "coingecko_public_fallback",
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
