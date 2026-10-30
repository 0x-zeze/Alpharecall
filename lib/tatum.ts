import type { SuiNodeStatus, PredictionResolutionResult } from "./types";

/**
 * Fetch live Sui Network metrics via Tatum Sui Gateway or public RPC.
 * Never returns fake numbers or hardcoded epochs.
 * If unreachable or keys missing, explicitly returns ok: false, status: "unavailable".
 */
export async function getSuiMetrics(): Promise<SuiNodeStatus> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const startTime = Date.now();

  const isTatumConfigured = Boolean(tatumApiKey && tatumApiKey !== "your_tatum_api_key_here");
  const rpcUrl = isTatumConfigured
    ? "https://sui-mainnet.gateway.tatum.io"
    : "https://fullnode.mainnet.sui.io:443";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isTatumConfigured && tatumApiKey) {
    headers["x-api-key"] = tatumApiKey;
  }

  try {
    // 1. Fetch latest checkpoint
    const checkpointRes = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
      cache: "no-store",
    });

    if (!checkpointRes.ok) {
      throw new Error(`HTTP ${checkpointRes.status} from RPC endpoint (${isTatumConfigured ? "Tatum Gateway" : "Public Node"})`);
    }

    const checkpointData = await checkpointRes.json();
    if (checkpointData?.error) {
      throw new Error(checkpointData.error.message || "RPC returned error");
    }

    const checkpoint = checkpointData?.result ? String(checkpointData.result) : null;

    // 2. Fetch reference gas price
    let referenceGasPrice: string | null = null;
    try {
      const gasRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "suix_getReferenceGasPrice",
          params: [],
        }),
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

    // 3. Fetch real epoch from suix_getLatestSuiSystemState (never hardcode!)
    let epoch: string | null = null;
    try {
      const systemStateRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "suix_getLatestSuiSystemState",
          params: [],
        }),
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

    // 4. Fetch chain identifier
    let chainIdentifier: string | null = null;
    try {
      const chainRes = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "sui_getChainIdentifier",
          params: [],
        }),
        cache: "no-store",
      });
      if (chainRes.ok) {
        const chainData = await chainRes.json();
        if (chainData?.result) {
          chainIdentifier = String(chainData.result);
        }
      }
    } catch {
      chainIdentifier = null;
    }

    const latencyMs = Date.now() - startTime;

    return {
      ok: true,
      status: "live",
      checkpoint,
      epoch, // Real epoch from suix_getLatestSuiSystemState or null
      referenceGasPrice,
      chainIdentifier,
      latencyMs,
      isTatumGateway: isTatumConfigured,
      rpcUrl: isTatumConfigured ? "sui-mainnet.gateway.tatum.io" : "fullnode.mainnet.sui.io (public)",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "RPC endpoint unreachable";
    return {
      ok: false,
      status: "unavailable",
      checkpoint: null,
      epoch: null,
      referenceGasPrice: null,
      chainIdentifier: null,
      latencyMs: null,
      isTatumGateway: isTatumConfigured,
      rpcUrl: isTatumConfigured ? "sui-mainnet.gateway.tatum.io" : "unavailable",
      errorMessage: isTatumConfigured
        ? `Tatum Gateway error: ${errorMsg}`
        : `Tatum unavailable (${errorMsg})`,
    };
  }
}

/**
 * Fetch real-time cryptocurrency exchange rate from Tatum Data API.
 * Uses https://api.tatum.io/v3/tatum/rate/{symbol}?basePair={basePair}
 * with x-api-key header.
 */
export async function getTatumCryptoRate(
  symbol: string,
  basePair = "USD"
): Promise<{ ok: boolean; rate?: number; source?: string; error?: string }> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const isTatumConfigured = Boolean(tatumApiKey && tatumApiKey !== "your_tatum_api_key_here");

  if (!isTatumConfigured || !tatumApiKey) {
    return {
      ok: false,
      error: "TATUM_API_KEY not configured. Cannot query Tatum Data API.",
    };
  }

  try {
    const res = await fetch(
      `https://api.tatum.io/v3/tatum/rate/${symbol.toUpperCase()}?basePair=${basePair}`,
      {
        headers: {
          "x-api-key": tatumApiKey,
        },
        cache: "no-store",
      }
    );

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
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fallback public price oracle (CoinGecko) used strictly when Tatum API key is not configured.
 * Explicitly records source as fallback oracle.
 */
export async function getFallbackCryptoRate(
  symbol: "sui" | "bitcoin" | "ethereum"
): Promise<{ ok: boolean; rate?: number; source?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`,
      { cache: "no-store" }
    );
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Query real on-chain SUI balance for an address via Tatum Gateway.
 */
export async function getAddressBalance(address: string): Promise<number | null> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const isTatumConfigured = Boolean(tatumApiKey && tatumApiKey !== "your_tatum_api_key_here");
  const rpcUrl = isTatumConfigured
    ? "https://sui-mainnet.gateway.tatum.io"
    : "https://fullnode.mainnet.sui.io:443";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isTatumConfigured && tatumApiKey) headers["x-api-key"] = tatumApiKey;

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address, "0x2::sui::SUI"],
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.result?.totalBalance) return null;
    return Number(data.result.totalBalance) / 1e9;
  } catch {
    return null;
  }
}
