import { SuiNodeStatus, PredictionResolutionResult } from "./types";

/**
 * Fetch live Sui Network metrics via Tatum Sui Gateway or public RPC.
 * Never returns fake numbers. If unreachable or keys missing, explicitly returns status "unavailable".
 */
export async function getSuiMetrics(): Promise<SuiNodeStatus> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const startTime = Date.now();

  const rpcUrl = tatumApiKey
    ? "https://sui-mainnet.gateway.tatum.io"
    : "https://fullnode.mainnet.sui.io:443";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (tatumApiKey) {
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
      throw new Error(`HTTP ${checkpointRes.status} from RPC Gateway`);
    }

    const checkpointData = await checkpointRes.json();
    if (checkpointData?.error) {
      throw new Error(checkpointData.error.message || "RPC returned error");
    }

    const checkpoint = checkpointData?.result ? String(checkpointData.result) : null;

    // 2. Fetch reference gas price
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

    const gasData = await gasRes.json();
    const referenceGasPrice = gasData?.result ? `${gasData.result} MIST` : null;

    // 3. Fetch chain identifier
    const chainRes = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "sui_getChainIdentifier",
        params: [],
      }),
      cache: "no-store",
    });

    const chainData = await chainRes.json();
    const chainIdentifier = chainData?.result ? String(chainData.result) : null;
    const latencyMs = Date.now() - startTime;

    return {
      status: "live",
      checkpoint,
      epoch: null, // Only return when epoch method is explicitly queried
      referenceGasPrice,
      chainIdentifier,
      latencyMs,
      isTatumGateway: Boolean(tatumApiKey),
      rpcUrl: tatumApiKey ? "sui-mainnet.gateway.tatum.io" : "fullnode.mainnet.sui.io",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "RPC gateway offline or key unconfigured";
    return {
      status: "unavailable",
      checkpoint: null,
      epoch: null,
      referenceGasPrice: null,
      chainIdentifier: null,
      latencyMs: null,
      isTatumGateway: Boolean(tatumApiKey),
      rpcUrl: tatumApiKey ? "sui-mainnet.gateway.tatum.io" : "unavailable",
      errorMessage: errorMsg,
    };
  }
}

/**
 * Query real on-chain SUI balance for an address via Tatum Gateway.
 */
export async function getAddressBalance(address: string): Promise<number | null> {
  const tatumApiKey = process.env.TATUM_API_KEY;
  const rpcUrl = tatumApiKey
    ? "https://sui-mainnet.gateway.tatum.io"
    : "https://fullnode.mainnet.sui.io:443";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tatumApiKey) headers["x-api-key"] = tatumApiKey;

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
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.result?.totalBalance) return null;
    return Number(data.result.totalBalance) / 1e9;
  } catch {
    return null;
  }
}

/**
 * Resolve an on-chain SUI balance prediction via Tatum RPC.
 */
export async function resolveSuiBalancePrediction(
  predictionId: string,
  targetAddress: string,
  minExpectedBalanceSui: number
): Promise<PredictionResolutionResult> {
  const balance = await getAddressBalance(targetAddress);

  if (balance === null) {
    return {
      predictionId,
      resolved: false,
      outcome: "PENDING",
      proofType: "tatum_sui_rpc",
      proofDetail: `Unable to query onchain balance for ${targetAddress}. RPC unavailable or account nonexistent.`,
      timestamp: Date.now(),
    };
  }

  const isMet = balance >= minExpectedBalanceSui;
  return {
    predictionId,
    resolved: true,
    outcome: isMet ? "ACCURATE" : "FAILED",
    currentValue: balance,
    targetValue: minExpectedBalanceSui,
    proofType: "tatum_sui_rpc",
    proofDetail: `Verified on Sui Mainnet via Tatum RPC: Current Balance = ${balance.toFixed(4)} SUI (Threshold = ${minExpectedBalanceSui} SUI)`,
    timestamp: Date.now(),
  };
}

/**
 * Resolve an on-chain Sui gas price prediction via Tatum RPC.
 */
export async function resolveSuiGasPrediction(
  predictionId: string,
  maxGasThresholdMist: number
): Promise<PredictionResolutionResult> {
  const metrics = await getSuiMetrics();

  if (metrics.status !== "live" || !metrics.referenceGasPrice) {
    return {
      predictionId,
      resolved: false,
      outcome: "PENDING",
      proofType: "tatum_sui_rpc",
      proofDetail: "Tatum Sui RPC gas oracle temporarily unavailable.",
      timestamp: Date.now(),
    };
  }

  const gasNum = parseInt(metrics.referenceGasPrice, 10);
  const isAccurate = gasNum <= maxGasThresholdMist;

  return {
    predictionId,
    resolved: true,
    outcome: isAccurate ? "ACCURATE" : "FAILED",
    currentValue: gasNum,
    targetValue: maxGasThresholdMist,
    proofType: "tatum_sui_rpc",
    proofDetail: `Verified on Sui Mainnet via Tatum RPC: Gas Price = ${gasNum} MIST (Target Ceiling = ${maxGasThresholdMist} MIST)`,
    timestamp: Date.now(),
  };
}

/**
 * Resolve live cryptocurrency spot market predictions (SUI, BTC, ETH) using authentic oracle price feed.
 */
export async function resolveCryptoPricePrediction(
  predictionId: string,
  symbol: "sui" | "bitcoin" | "ethereum",
  targetPriceUsd: number,
  direction: "above" | "below"
): Promise<PredictionResolutionResult> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`Price oracle returned status ${res.status}`);
    }

    const data = await res.json();
    const currentPrice = data?.[symbol]?.usd;

    if (typeof currentPrice !== "number") {
      throw new Error(`Price data for ${symbol} not found in oracle response`);
    }

    const conditionMet = direction === "above" ? currentPrice >= targetPriceUsd : currentPrice <= targetPriceUsd;

    return {
      predictionId,
      resolved: true,
      outcome: conditionMet ? "ACCURATE" : "FAILED",
      currentValue: currentPrice,
      targetValue: targetPriceUsd,
      proofType: "crypto_oracle_price",
      proofDetail: `Verified via Oracle: ${symbol.toUpperCase()} Spot = $${currentPrice.toLocaleString()} (Target: ${direction} $${targetPriceUsd.toLocaleString()})`,
      timestamp: Date.now(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      predictionId,
      resolved: false,
      outcome: "PENDING",
      proofType: "crypto_oracle_price",
      proofDetail: `Price oracle resolution pending: ${msg}`,
      timestamp: Date.now(),
    };
  }
}
