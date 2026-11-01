import { NextResponse } from "next/server";
import { getAllMemories, saveMemory, checkWalrusConnection } from "@/lib/walrus";
import { getLatestSuiCheckpointAnchor } from "@/lib/tatum";
import { MAX_PREDICTION_HORIZON_MS } from "@/lib/resolver";
import type { PredictionCategory } from "@/lib/types";

// In-memory rate limiting (best-effort across serverless instances)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateLimitBucket>();
let globalBucket = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

const MAX_PER_IP_HOURLY = 30;
const MAX_GLOBAL_DAILY = 200;

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();

  // 1. Global daily cap
  if (now > globalBucket.resetAt) {
    globalBucket = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  }
  if (globalBucket.count >= MAX_GLOBAL_DAILY) {
    return {
      allowed: false,
      message: "Daily global rate limit reached (200 predictions/day). Please try again tomorrow.",
    };
  }

  // 2. IP hourly cap
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    if (bucket.count >= MAX_PER_IP_HOURLY) {
      const waitMinutes = Math.ceil((bucket.resetAt - now) / 60000);
      return {
        allowed: false,
        message: `Hourly rate limit exceeded for your IP (max 30/hour). Try again in ${waitMinutes}m.`,
      };
    }
    bucket.count++;
  }

  globalBucket.count++;
  return { allowed: true };
}

export async function GET() {
  try {
    const [memories, connectionStatus] = await Promise.all([
      getAllMemories(),
      checkWalrusConnection(),
    ]);

    return NextResponse.json({
      success: true,
      count: memories.length,
      data: memories,
      isMainnetConnected: connectionStatus.isMainnetConnected,
      mode: connectionStatus.mode,
      connectionError: connectionStatus.error,
      namespace: process.env.MEMWAL_NAMESPACE || "alpharecall",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // 1. Body Size Limit Check (max 32KB)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 32768) {
    return NextResponse.json(
      { success: false, error: "Payload too large. Maximum allowed size is 32KB." },
      { status: 413 }
    );
  }

  // 2. Rate Limiting Check
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: rateCheck.message },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const {
      title,
      content,
      analyst,
      target,
      pick,
      odds,
      stake,
      confidence,
      sportType,
      deadline,
      direction,
      targetPrice,
      asset,
    } = body;

    // 3. Strict String & Field Validations
    if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 120) {
      return NextResponse.json(
        { success: false, error: "Title is required and must be between 1 and 120 characters." },
        { status: 400 }
      );
    }
    if (!target || typeof target !== "string" || target.trim().length === 0 || target.length > 120) {
      return NextResponse.json(
        { success: false, error: "Target is required and must be between 1 and 120 characters." },
        { status: 400 }
      );
    }
    if (!pick || typeof pick !== "string" || pick.trim().length === 0 || pick.length > 100) {
      return NextResponse.json(
        { success: false, error: "Pick is required and must be between 1 and 100 characters." },
        { status: 400 }
      );
    }

    // 4. Validate Analyst Pattern: @[A-Za-z0-9_]{3,30}
    const analystStr = typeof analyst === "string" ? analyst.trim() : "";
    const analystRegex = /^@[A-Za-z0-9_]{3,30}$/;
    if (!analystRegex.test(analystStr)) {
      return NextResponse.json(
        {
          success: false,
          error: "Analyst handle must start with '@' followed by 3-30 alphanumeric characters or underscores (e.g. @OptaTactics).",
        },
        { status: 400 }
      );
    }

    // 5. Validate Category / SportType Enum
    const validCategories: PredictionCategory[] = ["soccer", "nba", "crypto", "sports"];
    const categoryVal: PredictionCategory = validCategories.includes(sportType as PredictionCategory)
      ? (sportType as PredictionCategory)
      : "soccer";

    // 6. Validate Confidence (1-5) and Stake (10 - 10,000)
    const confVal = Math.min(5, Math.max(1, parseInt(String(confidence), 10) || 4));
    const stakeVal = Math.min(10000, Math.max(10, parseFloat(String(stake)) || 250));

    // 7. Validate Crypto Deadline Requirements (Bagian 2)
    let parsedDeadlineIso: string | undefined = undefined;
    if (categoryVal === "crypto") {
      if (!deadline || typeof deadline !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Crypto forecast predictions require a valid future deadline.",
          },
          { status: 400 }
        );
      }

      const deadlineMs = Date.parse(deadline);
      if (isNaN(deadlineMs)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid deadline format. Must be a parseable ISO-8601 date string.",
          },
          { status: 400 }
        );
      }

      const now = Date.now();
      if (deadlineMs <= now) {
        return NextResponse.json(
          {
            success: false,
            error: "Deadline must be strictly in the future.",
          },
          { status: 400 }
        );
      }

      if (deadlineMs > now + MAX_PREDICTION_HORIZON_MS) {
        return NextResponse.json(
          {
            success: false,
            error: "Prediction deadline cannot exceed 30 days into the future.",
          },
          { status: 400 }
        );
      }

      parsedDeadlineIso = new Date(deadlineMs).toISOString();
    } else if (deadline && typeof deadline === "string") {
      const dMs = Date.parse(deadline);
      if (!isNaN(dMs)) parsedDeadlineIso = new Date(dMs).toISOString();
    }

    // 8. Security Hardening: Client cannot dictate outcome or credibility deltas!
    // Server strictly enforces outcome = "PENDING" and credibilityDelta = 0.
    const sanitizedOutcome = "PENDING";
    const sanitizedDelta = 0;
    const sanitizedPnl = 0;

    // 9. Anchor Checkpoint from Tatum / Sui Gateway (Bagian 3)
    const anchor = await getLatestSuiCheckpointAnchor();

    // 10. Persist structured prediction to Walrus Memory
    const saved = await saveMemory({
      title: title.trim(),
      content:
        typeof content === "string" && content.trim().length > 0
          ? content.trim().slice(0, 500)
          : `Forecast for ${target.trim()}: ${pick.trim()}`,
      analyst: analystStr,
      target: target.trim(),
      pick: pick.trim(),
      outcome: sanitizedOutcome,
      credibilityDelta: sanitizedDelta,
      pnl: sanitizedPnl,
      category: "prediction",
      sportType: categoryVal,
      odds: typeof odds === "string" ? odds.trim().slice(0, 20) : "-110",
      stake: stakeVal,
      confidence: confVal,
      deadline: parsedDeadlineIso,
      direction: direction === "above" || direction === "below" ? direction : undefined,
      targetPrice: typeof targetPrice === "number" && !isNaN(targetPrice) ? targetPrice : undefined,
      asset: typeof asset === "string" ? asset.trim().slice(0, 20) : undefined,
      suiCheckpoint: anchor.checkpoint,
      suiCheckpointDigest: anchor.digest,
      suiCheckpointSource: anchor.source,
    });

    const sourceLabel =
      anchor.source === "tatum-gateway"
        ? " via Tatum gateway"
        : anchor.source === "sui-graphql"
        ? " via Sui GraphQL"
        : "";

    return NextResponse.json({
      success: true,
      data: saved,
      status: saved.writeStatus,
      blobId: saved.blobId,
      suiAnchor: anchor.checkpoint ? `#${anchor.checkpoint}${sourceLabel}` : "not anchored",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
