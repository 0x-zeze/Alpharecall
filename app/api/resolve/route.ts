import { NextResponse } from "next/server";
import { resolveDuePredictions } from "@/lib/resolver";
import { getAllMemories } from "@/lib/walrus";

export const maxDuration = 60;

// In-memory cooldown gate (60 seconds) to prevent spamming Walrus & Tatum APIs
let lastResolveTimestampMs = 0;
const RESOLVE_COOLDOWN_MS = 60 * 1000;

/**
 * Public Endpoint triggered by "Check results now" button in UI.
 * Security & Reliability Invariants:
 * - NEVER accepts candidates from request body (prevents synthetic outcome injection).
 * - Always loads genuine pending forecast memories via Walrus recall.
 * - Enforces a 60-second cooldown to respect external API rate limits.
 */
export async function POST() {
  try {
    const now = Date.now();
    const elapsedSinceLastResolve = now - lastResolveTimestampMs;

    if (elapsedSinceLastResolve < RESOLVE_COOLDOWN_MS && lastResolveTimestampMs !== 0) {
      const waitSeconds = Math.ceil((RESOLVE_COOLDOWN_MS - elapsedSinceLastResolve) / 1000);
      return NextResponse.json({
        success: true,
        cooldownActive: true,
        message: `Resolution cooldown active. Please wait ${waitSeconds}s before checking results again.`,
        totalEvaluated: 0,
        resolvedCount: 0,
        skippedCount: 0,
        batchDeferredCount: 0,
        results: [],
      });
    }

    lastResolveTimestampMs = now;

    // Fetch genuine pending records strictly from Walrus memory storage
    const all = await getAllMemories();
    const candidates = all.filter((p) => p.outcome === "PENDING");

    const report = await resolveDuePredictions(candidates, now);
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
 * Automated Cron Trigger (e.g. Vercel Cron or GitHub Action).
 * Security Invariant: FAIL-CLOSED.
 * If CRON_SECRET is not configured or Authorization header does not match, returns 401.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // Fail-closed security gate
  if (isProduction || cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized: CRON_SECRET is required to execute cron resolutions." },
        { status: 401 }
      );
    }
  }

  try {
    const now = Date.now();
    const elapsedSinceLastResolve = now - lastResolveTimestampMs;

    // Enforce 60s cooldown to respect API rate limits
    if (elapsedSinceLastResolve < RESOLVE_COOLDOWN_MS && lastResolveTimestampMs !== 0) {
      const waitSeconds = Math.ceil((RESOLVE_COOLDOWN_MS - elapsedSinceLastResolve) / 1000);
      return NextResponse.json({
        success: true,
        cooldownActive: true,
        message: `Resolution cooldown active. Please wait ${waitSeconds}s before checking results again.`,
        totalEvaluated: 0,
        resolvedCount: 0,
        skippedCount: 0,
        batchDeferredCount: 0,
        results: [],
      });
    }

    lastResolveTimestampMs = now;

    const all = await getAllMemories();
    const pendingPicks = all.filter((p) => p.outcome === "PENDING");
    const report = await resolveDuePredictions(pendingPicks, now);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
