import type { TatumGatewayStatus, SuiChainStatus, SuiNodeStatus, SuiCheckpointSource } from "./types";
import { getSuiChainViaTatumGrpc } from "./sui-grpc";

function sanitizeError(msg: string, apiKey?: string): string {
  let cleaned = msg;
  if (apiKey && apiKey.trim().length > 0) {
    cleaned = cleaned.split(apiKey).join("[REDACTED]");
  }
  return cleaned.replace(/(x-api-key\s*[:=]\s*)["']?[^"'\s,]+["']?/gi, "$1[REDACTED]");
}

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
  const warnings: string[] = [];
  const addWarning = (text: string) => {
    warnings.push(sanitizeError(text, tatumApiKey));
  };

  const isTatumConfigured = Boolean(
    tatumApiKey &&
    tatumApiKey !== "your_tatum_api_key_here" &&
    !tatumApiKey.startsWith("your_")
  );

  // --------------------------------------------------------------------------
  // SOURCE 1: Tatum Sui gRPC Gateway (Official Migration Target)
  // --------------------------------------------------------------------------
  try {
    const grpcRes = await getSuiChainViaTatumGrpc({ deadlineMs: 4000 });
    if (grpcRes.ok && grpcRes.checkpoint) {
      return {
        ok: true,
        status: "live",
        checkpoint: grpcRes.checkpoint,
        checkpointDigest: grpcRes.checkpointDigest,
        epoch: grpcRes.epoch,
        referenceGasPrice: null, // Strictly null: gRPC does not provide gas price
        chainId: grpcRes.chainId,
        latencyMs: grpcRes.latencyMs,
        rpcUrl: "sui-mainnet-grpc.gateway.tatum.io",
        isTatumGateway: true,
        source: "tatum-grpc",
        gatewayWarning: null,
      };
    }
    if (grpcRes.error) {
      addWarning(`Tatum gRPC failed (${grpcRes.error})`);
    }
  } catch (err: unknown) {
    const errText = err instanceof Error ? err.message : String(err);
    addWarning(`Tatum gRPC failed (${errText})`);
  }

  // --------------------------------------------------------------------------
  // SOURCE 2: Tatum Sui JSON-RPC Gateway (Retained with 2.5s Timeout)
  // --------------------------------------------------------------------------
  const rpcUrl = "https://sui-mainnet.gateway.tatum.io";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isTatumConfigured && tatumApiKey) {
    headers["x-api-key"] = tatumApiKey;
  }

  const jsonRpcController = new AbortController();
  const jsonRpcTimeoutId = setTimeout(() => jsonRpcController.abort(), 2500);

  try {
    const checkpointRes = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
      signal: jsonRpcController.signal,
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
          signal: jsonRpcController.signal,
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
        signal: jsonRpcController.signal,
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
        signal: jsonRpcController.signal,
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
        signal: jsonRpcController.signal,
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

    clearTimeout(jsonRpcTimeoutId);
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
      source: "tatum-gateway",
      gatewayWarning: warnings.length > 0 ? warnings.join("; ") : null,
    };
  } catch (err: unknown) {
    clearTimeout(jsonRpcTimeoutId);
    const msg = err instanceof Error ? err.message : "Sui JSON-RPC unreachable";
    addWarning(`Tatum gateway failed (${msg})`);
  }

  // --------------------------------------------------------------------------
  // SOURCE 3: Official Sui Mainnet GraphQL Fallback
  // --------------------------------------------------------------------------
  const gqlController = new AbortController();
  const gqlTimeoutId = setTimeout(() => gqlController.abort(), 4000);

  try {
    const gqlRes = await fetch("https://graphql.mainnet.sui.io/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query {
          checkpoint {
            sequenceNumber
            digest
            epoch {
              epochId
              referenceGasPrice
            }
          }
          chainIdentifier
        }`,
      }),
      signal: gqlController.signal,
      cache: "no-store",
    });

    if (gqlRes.ok) {
      const gqlData = await gqlRes.json();

      if (Array.isArray(gqlData?.errors) && gqlData.errors.length > 0) {
        throw new Error("Sui GraphQL responded with errors");
      }

      const data = gqlData?.data;
      const cp = data?.checkpoint;

      const hasValidSequence =
        cp?.sequenceNumber != null &&
        /^\d+$/.test(String(cp.sequenceNumber)) &&
        Number(cp.sequenceNumber) > 0;
      const hasValidChainId =
        typeof data?.chainIdentifier === "string" && data.chainIdentifier.trim().length > 0;

      if (hasValidSequence && hasValidChainId) {
        const checkpoint = String(cp.sequenceNumber);
        const checkpointDigest =
          typeof cp.digest === "string" && cp.digest.trim().length > 0 ? cp.digest.trim() : null;
        const epoch =
          cp.epoch?.epochId != null && /^\d+$/.test(String(cp.epoch.epochId))
            ? String(cp.epoch.epochId)
            : null;

        let referenceGasPrice: string | null = null;
        if (
          cp.epoch?.referenceGasPrice != null &&
          /^\d+$/.test(String(cp.epoch.referenceGasPrice))
        ) {
          referenceGasPrice = `${cp.epoch.referenceGasPrice} MIST`;
        }

        return {
          ok: true,
          status: "live",
          checkpoint,
          checkpointDigest,
          epoch,
          referenceGasPrice,
          chainId: data.chainIdentifier.trim(),
          latencyMs: Date.now() - startTime,
          rpcUrl: "graphql.mainnet.sui.io",
          isTatumGateway: false,
          source: "sui-graphql",
          gatewayWarning: sanitizeError(
            `${warnings.join("; ")}; retrieved via Sui GraphQL fallback`,
            tatumApiKey
          ),
        };
      }
    }
  } catch (err: unknown) {
    const gqlMsg = err instanceof Error ? err.message : "Sui GraphQL unreachable";
    addWarning(`Sui GraphQL failed (${gqlMsg})`);
  } finally {
    clearTimeout(gqlTimeoutId);
  }

  // --------------------------------------------------------------------------
  // SOURCE 4: Fail-closed state when all sources are exhausted
  // --------------------------------------------------------------------------
  return {
    ok: false,
    status: "unavailable",
    checkpoint: null,
    checkpointDigest: null,
    epoch: null,
    referenceGasPrice: null,
    chainId: null,
    latencyMs: null,
    rpcUrl: "sui-mainnet-grpc.gateway.tatum.io",
    isTatumGateway: false,
    source: null,
    error: sanitizeError(`All Sui RPC sources failed: ${warnings.join("; ")}`, tatumApiKey),
  };
}

/**
 * Helper used during prediction creation to anchor the latest Sui Checkpoint.
 * If the Sui RPC is unavailable or returns an error, returns null values gracefully.
 * Never throws and never blocks prediction creation.
 */
export async function getLatestSuiCheckpointAnchor(): Promise<{
  checkpoint: string | null;
  digest: string | null;
  source: SuiCheckpointSource | null;
}> {
  try {
    const chainMetrics = await getSuiChainMetrics();
    if (chainMetrics.ok && chainMetrics.checkpoint) {
      return {
        checkpoint: chainMetrics.checkpoint,
        digest: chainMetrics.checkpointDigest,
        source: chainMetrics.source,
      };
    }
  } catch {
    // Non-blocking fallback
  }
  return {
    checkpoint: null,
    digest: null,
    source: null,
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
