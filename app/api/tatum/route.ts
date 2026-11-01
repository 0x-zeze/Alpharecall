import { NextResponse } from "next/server";
import { getTatumGatewayStatus, getSuiChainMetrics } from "@/lib/tatum";

export async function GET() {
  try {
    const [tatumStatus, suiStatus] = await Promise.all([
      getTatumGatewayStatus(),
      getSuiChainMetrics(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tatum: tatumStatus,
        sui: suiStatus,
        // Backward-compatible fields — strictly consistent with suiStatus
        ok: tatumStatus.ok,
        status: tatumStatus.status,
        plan: tatumStatus.plan,
        creditLimit: tatumStatus.creditLimit,
        latencyMs: tatumStatus.latencyMs,
        checkpoint: suiStatus.checkpoint,
        epoch: suiStatus.epoch,
        referenceGasPrice: suiStatus.referenceGasPrice,
        chainId: suiStatus.chainId,
        isTatumGateway: suiStatus.isTatumGateway,
        source: suiStatus.source,
        gatewayWarning: suiStatus.gatewayWarning || null,
      },
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
