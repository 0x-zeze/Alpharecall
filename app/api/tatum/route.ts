import { NextResponse } from "next/server";
import { getSuiMetrics } from "@/lib/tatum";


export async function GET() {
  try {
    const metrics = await getSuiMetrics();
    return NextResponse.json({
      success: true,
      data: metrics,
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
