import { NextResponse } from "next/server";
import {
  resolveCryptoPricePrediction,
  resolveSuiGasPrediction,
  resolveSuiBalancePrediction,
} from "@/lib/tatum";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { predictionId, type } = body;

    if (!predictionId || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: predictionId, type" },
        { status: 400 }
      );
    }

    if (type === "crypto_price") {
      const { symbol, targetPrice, direction } = body;
      const result = await resolveCryptoPricePrediction(
        predictionId,
        symbol || "sui",
        Number(targetPrice),
        direction || "above"
      );
      return NextResponse.json({ success: true, data: result });
    }

    if (type === "sui_gas") {
      const { maxGasMist } = body;
      const result = await resolveSuiGasPrediction(
        predictionId,
        Number(maxGasMist || 1000)
      );
      return NextResponse.json({ success: true, data: result });
    }

    if (type === "sui_balance") {
      const { targetAddress, minBalanceSui } = body;
      const result = await resolveSuiBalancePrediction(
        predictionId,
        targetAddress,
        Number(minBalanceSui || 1.0)
      );
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported resolution type: ${type}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
