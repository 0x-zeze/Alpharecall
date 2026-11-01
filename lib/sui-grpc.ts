import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "node:path";
import * as fs from "node:fs";

export interface SuiGrpcChainMetrics {
  ok: boolean;
  checkpoint: string | null;
  checkpointDigest: string | null;
  epoch: string | null;
  chainId: string | null;
  referenceGasPrice: string | null;
  timestampMs: number | null;
  latencyMs: number;
  error: string | null;
}

export interface GrpcServiceInfoResponse {
  chainId?: string;
  chain_id?: string;
  chain?: string;
  epoch?: string | number | bigint;
  checkpointHeight?: string | number | bigint;
  checkpoint_height?: string | number | bigint;
  timestamp?: {
    seconds?: string | number | bigint;
    nanos?: number;
  };
  server?: string;
}

export interface GrpcCheckpointResponse {
  checkpoint?: {
    sequenceNumber?: string | number | bigint;
    sequence_number?: string | number | bigint;
    digest?: string;
  };
}

export interface LedgerServiceClient extends grpc.Client {
  GetServiceInfo(
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
    options: { deadline?: Date },
    callback: (err: grpc.ServiceError | null, response: GrpcServiceInfoResponse) => void
  ): void;
  GetCheckpoint(
    request: { sequenceNumber?: string; sequence_number?: string; digest?: string },
    metadata: grpc.Metadata,
    options: { deadline?: Date },
    callback: (err: grpc.ServiceError | null, response: GrpcCheckpointResponse) => void
  ): void;
}

export interface TatumGrpcOptions {
  endpoint?: string;
  apiKey?: string;
  insecure?: boolean;
  deadlineMs?: number;
  customClient?: LedgerServiceClient;
}

export const DEFAULT_TATUM_GRPC_ENDPOINT = "sui-mainnet-grpc.gateway.tatum.io:443";
export const GRPC_CALL_DEADLINE_MS = 5000;
export const GRPC_TOTAL_TIMEOUT_MS = 6000;

let cachedPackageDef: protoLoader.PackageDefinition | null = null;

function sanitizeErrorMessage(msg: string, apiKey?: string): string {
  let cleaned = msg;
  if (apiKey && apiKey.trim().length > 0) {
    cleaned = cleaned.split(apiKey).join("[REDACTED]");
  }
  return cleaned.replace(/(x-api-key\s*[:=]\s*)["']?[^"'\s,]+["']?/gi, "$1[REDACTED]");
}

/**
 * Loads the Sui RPC v2 Protocol Buffer package definition.
 * Prioritizes the vendored proto files if present; falls back to pre-compiled descriptor JSON.
 */
export function getSuiLedgerPackageDefinition(): protoLoader.PackageDefinition {
  if (cachedPackageDef) return cachedPackageDef;

  const protoDir = path.join(process.cwd(), "proto");
  const protoFile = path.join(protoDir, "sui", "rpc", "v2", "ledger_service.proto");

  if (fs.existsSync(protoFile)) {
    cachedPackageDef = protoLoader.loadSync(protoFile, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoDir],
    });
    return cachedPackageDef;
  }

  const descriptorFile = path.join(protoDir, "ledger-service-descriptor.json");
  if (fs.existsSync(descriptorFile)) {
    const json = JSON.parse(fs.readFileSync(descriptorFile, "utf-8"));
    cachedPackageDef = protoLoader.fromJSON(json, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return cachedPackageDef;
  }

  throw new Error("Proto definitions for Sui LedgerService not found in proto/ directory.");
}

/**
 * Maps gRPC errors to standardized, secure error messages without revealing credentials.
 */
function mapGrpcError(err: unknown, method: string, apiKey?: string): string {
  const serviceErr = err as (grpc.ServiceError & { details?: string }) | undefined;
  const code = serviceErr?.code;
  const rawMsg = serviceErr?.details || serviceErr?.message || String(err);
  const sanitized = sanitizeErrorMessage(rawMsg, apiKey);

  if (code === grpc.status.UNAUTHENTICATED || code === grpc.status.PERMISSION_DENIED) {
    return "Tatum gRPC auth failed (check TATUM_API_KEY / plan)";
  }
  if (code === grpc.status.UNAVAILABLE || code === grpc.status.DEADLINE_EXCEEDED) {
    return "Tatum gRPC unreachable";
  }
  if (code === grpc.status.UNIMPLEMENTED) {
    return `Tatum gRPC method not implemented (${method}): ${sanitized}`;
  }

  return `Tatum gRPC error [code ${code ?? "unknown"}]: ${sanitized}`;
}

/**
 * Queries Sui ledger information via Tatum gRPC Gateway.
 * - Source attribute: "tatum-grpc"
 * - Channel: TLS over port 443 with x-api-key metadata
 * - Deadline: 5s per RPC call, max 6s overall budget
 * - Sockets: explicitly closed in finally block to avoid serverless connection leakage
 */
export async function getSuiChainViaTatumGrpc(
  options: TatumGrpcOptions = {}
): Promise<SuiGrpcChainMetrics> {
  const start = Date.now();
  const endpoint = options.endpoint || process.env.TATUM_SUI_GRPC_ENDPOINT || DEFAULT_TATUM_GRPC_ENDPOINT;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (process.env.TATUM_API_KEY || "");
  const callDeadlineMs = options.deadlineMs || GRPC_CALL_DEADLINE_MS;

  let client: LedgerServiceClient | undefined = options.customClient;
  let ownClient = false;

  try {
    if (!client) {
      const packageDef = getSuiLedgerPackageDefinition();
      const proto = grpc.loadPackageDefinition(packageDef) as unknown as {
        sui?: { rpc?: { v2?: { LedgerService?: grpc.ServiceClientConstructor } } };
      };
      const LedgerService = proto.sui?.rpc?.v2?.LedgerService;

      if (!LedgerService) {
        throw new Error("sui.rpc.v2.LedgerService could not be loaded from proto definitions.");
      }

      const creds =
        options.insecure || endpoint.startsWith("localhost") || endpoint.startsWith("127.0.0.1")
          ? grpc.credentials.createInsecure()
          : grpc.credentials.createSsl();

      client = new LedgerService(endpoint, creds) as unknown as LedgerServiceClient;
      ownClient = true;
    }

    const metadata = new grpc.Metadata();
    if (apiKey) {
      metadata.set("x-api-key", apiKey);
    }

    // Step 1: Call GetServiceInfo (5s deadline)
    const deadline1 = new Date(Date.now() + callDeadlineMs);
    const serviceInfo: GrpcServiceInfoResponse = await new Promise((resolve, reject) => {
      client?.GetServiceInfo({}, metadata, { deadline: deadline1 }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });

    const rawHeight = serviceInfo?.checkpointHeight ?? serviceInfo?.checkpoint_height;
    const checkpointStr =
      rawHeight !== undefined && rawHeight !== null && String(rawHeight).trim().length > 0
        ? String(rawHeight).trim()
        : null;

    const rawEpoch = serviceInfo?.epoch;
    const epochStr =
      rawEpoch !== undefined && rawEpoch !== null && String(rawEpoch).trim().length > 0
        ? String(rawEpoch).trim()
        : null;

    const rawChainId = serviceInfo?.chainId ?? serviceInfo?.chain_id;
    const chainIdStr =
      typeof rawChainId === "string" && rawChainId.trim().length > 0 ? rawChainId.trim() : null;

    let timestampMs: number | null = null;
    const ts = serviceInfo?.timestamp;
    if (ts) {
      const sec = typeof ts.seconds === "string" ? parseInt(ts.seconds, 10) : Number(ts.seconds);
      const nanos = Number(ts.nanos || 0);
      if (!isNaN(sec) && sec > 0) {
        timestampMs = sec * 1000 + Math.round(nanos / 1e6);
      }
    }

    if (!checkpointStr) {
      return {
        ok: false,
        checkpoint: null,
        checkpointDigest: null,
        epoch: epochStr,
        chainId: chainIdStr,
        referenceGasPrice: null,
        timestampMs,
        latencyMs: Date.now() - start,
        error: "GetServiceInfo returned empty checkpoint_height",
      };
    }

    // Step 2: Call GetCheckpoint using sequenceNumber to fetch digest (capped to remaining budget)
    let digestStr: string | null = null;
    const remainingBudgetMs = Math.max(1000, GRPC_TOTAL_TIMEOUT_MS - (Date.now() - start));
    const deadline2 = new Date(Date.now() + Math.min(callDeadlineMs, remainingBudgetMs));

    try {
      const checkpointRes: GrpcCheckpointResponse = await new Promise((resolve, reject) => {
        client?.GetCheckpoint(
          { sequenceNumber: checkpointStr },
          metadata,
          { deadline: deadline2 },
          (err, response) => {
            if (err) reject(err);
            else resolve(response);
          }
        );
      });

      const ck = checkpointRes?.checkpoint;
      const rawDigest = ck?.digest;
      if (typeof rawDigest === "string" && rawDigest.trim().length > 0) {
        digestStr = rawDigest.trim();
      }
    } catch {
      // If GetCheckpoint fails (e.g. historical pruned or optional method unavailable),
      // we gracefully preserve the checkpoint height from GetServiceInfo with null digest.
      // We NEVER fabricate a digest.
      digestStr = null;
    }

    return {
      ok: true,
      checkpoint: checkpointStr,
      checkpointDigest: digestStr,
      epoch: epochStr,
      chainId: chainIdStr,
      referenceGasPrice: null, // Strictly null: gRPC LedgerService does not report gas price; no faking.
      timestampMs,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (err: unknown) {
    const errMessage = mapGrpcError(err, "GetServiceInfo", apiKey);
    return {
      ok: false,
      checkpoint: null,
      checkpointDigest: null,
      epoch: null,
      chainId: null,
      referenceGasPrice: null,
      timestampMs: null,
      latencyMs: Date.now() - start,
      error: errMessage,
    };
  } finally {
    if (ownClient && client && typeof client.close === "function") {
      try {
        client.close();
      } catch {
        // Safe channel teardown
      }
    }
  }
}
