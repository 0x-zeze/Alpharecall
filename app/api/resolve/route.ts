import { NextResponse } from "next/server";
import { resolveDuePredictions } from "@/lib/resolver";
import { getAllMemories } from "@/lib/walrus";

/**
 * Endpoint for resolving due predictions.
 * Safe to call repeatedly (idempotent).
 */
export async function POST(req: Request) {
  try {
    let candidates = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.predictions) && body.predictions.length > 0) {
        candidates = body.predictions;
      }
    } catch {
      // Body is optional
    }

    if (candidates.length === 0) {
      const all = await getAllMemories();
      candidates = all.filter((p) => p.outcome === "PENDING");
    }

    const report = await resolveDuePredictions(candidates);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * Optional Vercel Cron trigger: protected with CRON_SECRET if configured.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }
  }

  try {
    const all = await getAllMemories();
    const pendingPicks = all.filter((p) => p.outcome === "PENDING");
    const report = await resolveDuePredictions(pendingPicks);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
