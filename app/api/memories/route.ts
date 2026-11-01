import { NextResponse } from "next/server";
import { getAllMemories, saveMemory, checkWalrusConnection } from "@/lib/walrus";
import { getLatestSuiCheckpointAnchor } from "@/lib/tatum";
import { MAX_PREDICTION_HORIZON_MS } from "@/lib/resolver";
import type { PredictionCategory, SportsFixtureRef, SportsMarketRef } from "@/lib/types";
import { getVerifiedFixtureById } from "@/lib/fixtures";
import { SUPPORTED_LEAGUES } from "@/lib/espn";

// In-memory rate limiting (best-effort across serverless instances)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateLimitBucket>();
let globalBucket = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

const MAX_PER_IP_HOURLY = 30;
const MAX_GLOBAL_DAILY = 200;

/**
 * In-memory idempotency and deduplication caches.
 * Note on Serverless Architecture:
 * On serverless platforms (such as Vercel), in-memory maps are best-effort and persist
 * only within a warm lambda container instance. For distributed multi-region consistency,
 * an external persistence layer such as Upstash Redis or durable KV is recommended.
 */
interface ProcessedRequestRecord {
  responsePayload: Record<string, unknown>;
  timestamp: number;
}
const requestIdCache = new Map<string, ProcessedRequestRecord>();
const REQUEST_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface ContentDedupeEntry {
  record: unknown;
  timestamp: number;
}
const contentDedupeMap = new Map<string, ContentDedupeEntry>();
const CONTENT_DEDUPE_WINDOW_MS = 60 * 1000; // 60 seconds

function pruneDedupeCaches(now: number) {
  requestIdCache.forEach((entry, id) => {
    if (now - entry.timestamp > REQUEST_ID_TTL_MS) {
      requestIdCache.delete(id);
    }
  });
  contentDedupeMap.forEach((entry, key) => {
    if (now - entry.timestamp > CONTENT_DEDUPE_WINDOW_MS) {
      contentDedupeMap.delete(key);
    }
  });
}

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
      reasoning,
      sportType,
      deadline,
      direction,
      targetPrice,
      asset,
      clientRequestId,
      fixture,
      market,
    } = body;

    const now = Date.now();
    pruneDedupeCaches(now);

    // 2.1 Dedupe by clientRequestId (10-minute idempotency cache)
    const clientReqId = typeof clientRequestId === "string" ? clientRequestId.trim() : "";
    if (clientReqId) {
      const cached = requestIdCache.get(clientReqId);
      if (cached && now - cached.timestamp <= REQUEST_ID_TTL_MS) {
        return NextResponse.json(cached.responsePayload);
      }
    }

    // 3. Strict String & Field Validations
    const isStructuredSports = fixture && typeof fixture === "object";
    if (!isStructuredSports) {
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
    let validatedTargetPrice: number | undefined = undefined;
    let verifiedFixture: SportsFixtureRef | undefined = undefined;
    let verifiedMarket: SportsMarketRef | undefined = undefined;
    let finalTarget = target.trim();
    let finalPick = pick.trim();
    let finalTitle = typeof title === "string" && title.trim() ? title.trim() : `${finalTarget}: ${finalPick}`;
    const extraTags: string[] = [];

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

      // Validate targetPrice > 0 for crypto forecasts
      const rawTp =
        typeof targetPrice === "number"
          ? targetPrice
          : typeof targetPrice === "string"
          ? parseFloat(targetPrice.trim().replace(",", "."))
          : NaN;

      if (isNaN(rawTp) || rawTp <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Crypto forecast predictions require a valid targetPrice greater than 0.",
          },
          { status: 400 }
        );
      }
      validatedTargetPrice = rawTp;
    } else if (fixture && typeof fixture === "object") {
      // FASE D: Structured Sports Fixture Validation
      const f = fixture as Record<string, unknown>;
      const eventId = String(f.eventId || "").trim();
      const sport = f.sport as "nba" | "soccer";
      const league = String(f.league || "").trim();

      if (!eventId || !sport || !league || !SUPPORTED_LEAGUES[league] || SUPPORTED_LEAGUES[league].sport !== sport) {
        return NextResponse.json(
          { success: false, error: "Invalid sports fixture payload or unsupported league." },
          { status: 400 }
        );
      }

      // Cross-verify with ESPN scoreboard / cache
      let serverFixture;
      try {
        serverFixture = await getVerifiedFixtureById(sport, league, eventId);
      } catch {
        return NextResponse.json(
          { success: false, error: "ESPN scoreboard unreachable. Please try manual entry mode." },
          { status: 503 }
        );
      }

      if (!serverFixture) {
        return NextResponse.json(
          { success: false, error: "Fixture not found on ESPN public schedule or match already commenced." },
          { status: 422 }
        );
      }

      const kickoffMs = Date.parse(serverFixture.kickoff);
      const MIN_BUFFER = 10 * 60 * 1000;
      if (kickoffMs <= now + MIN_BUFFER) {
        return NextResponse.json(
          { success: false, error: "Cannot predict a match starting within 10 minutes or already past." },
          { status: 422 }
        );
      }

      if (kickoffMs > now + 14 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: "Kickoff cannot exceed 14 days into the future." },
          { status: 400 }
        );
      }

      // Validate market structure
      if (!market || typeof market !== "object") {
        return NextResponse.json(
          { success: false, error: "Structured sports forecast requires a valid market." },
          { status: 400 }
        );
      }

      const m = market as Record<string, unknown>;
      const mType = m.type;
      const mSelection = String(m.selection || "").trim();

      if (mType !== "moneyline" && mType !== "total") {
        return NextResponse.json(
          { success: false, error: "Invalid market type. Must be 'moneyline' or 'total'." },
          { status: 400 }
        );
      }

      if (mType === "moneyline") {
        const allowedMoneyline = sport === "soccer" ? ["home", "away", "draw"] : ["home", "away"];
        if (!allowedMoneyline.includes(mSelection)) {
          return NextResponse.json(
            { success: false, error: `Invalid moneyline selection '${mSelection}' for ${sport}.` },
            { status: 400 }
          );
        }
        verifiedMarket = {
          type: "moneyline",
          selection: mSelection as "home" | "away" | "draw",
        };
        const winnerName =
          mSelection === "home"
            ? `${serverFixture.home.name} to Win`
            : mSelection === "away"
            ? `${serverFixture.away.name} to Win`
            : "Draw";
        finalPick = winnerName;
      } else {
        // Total Over/Under
        if (mSelection !== "over" && mSelection !== "under") {
          return NextResponse.json(
            { success: false, error: "Total market selection must be 'over' or 'under'." },
            { status: 400 }
          );
        }
        const line = typeof m.line === "number" ? m.line : parseFloat(String(m.line || ""));
        if (isNaN(line) || Math.abs(line % 1) !== 0.5) {
          return NextResponse.json(
            { success: false, error: "Total market line must be a half-number (x.5) to avoid ties." },
            { status: 400 }
          );
        }
        if (sport === "nba" && (line < 100 || line > 350)) {
          return NextResponse.json(
            { success: false, error: "NBA total line must be between 100.5 and 350.5." },
            { status: 400 }
          );
        }
        if (sport === "soccer" && (line < 0.5 || line > 9.5)) {
          return NextResponse.json(
            { success: false, error: "Soccer total line must be between 0.5 and 9.5." },
            { status: 400 }
          );
        }
        verifiedMarket = {
          type: "total",
          selection: mSelection as "over" | "under",
          line,
        };
        finalPick = `${mSelection === "over" ? "Over" : "Under"} ${line} Total Goals/Points`;
      }

      // Server takes control of title, target, deadline, and fixture data
      parsedDeadlineIso = serverFixture.kickoff;
      finalTarget = `${serverFixture.home.name} vs ${serverFixture.away.name}`;
      finalTitle = `${serverFixture.home.name} vs ${serverFixture.away.name} (${serverFixture.leagueLabel}): ${finalPick}`;
      verifiedFixture = {
        provider: "espn",
        eventId: serverFixture.eventId,
        sport: serverFixture.sport,
        league: serverFixture.league,
        leagueLabel: serverFixture.leagueLabel,
        kickoff: serverFixture.kickoff,
        home: serverFixture.home,
        away: serverFixture.away,
      };
    } else {
      // Manual sports entry fallback
      if (deadline && typeof deadline === "string") {
        const dMs = Date.parse(deadline);
        if (!isNaN(dMs)) parsedDeadlineIso = new Date(dMs).toISOString();
      }
      extraTags.push("unverified-fixture");
    }

    // 8. Security Hardening: Client cannot dictate outcome or credibility deltas!
    // Server strictly enforces outcome = "PENDING" and credibilityDelta = 0.
    const sanitizedOutcome = "PENDING";
    const sanitizedDelta = 0;
    const sanitizedPnl = 0;

    const assetStr = typeof asset === "string" && asset.trim().length > 0 ? asset.trim().slice(0, 20) : "SUI";
    const finalDirection: "above" | "below" = direction === "below" ? "below" : "above";

    // 8.1 Dedupe identical forecast (analyst + target + pick + deadline) within 60 seconds
    const contentFingerprint = `${analystStr}|${finalTarget}|${finalPick}|${parsedDeadlineIso || "no-deadline"}`.toLowerCase();
    const existingContent = contentDedupeMap.get(contentFingerprint);
    if (existingContent && now - existingContent.timestamp <= CONTENT_DEDUPE_WINDOW_MS) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate prediction: an identical forecast was already submitted within the last 60 seconds.",
          data: existingContent.record,
        },
        { status: 409 }
      );
    }

    // 8.2 Additional Sports duplicate gate (analyst + eventId + marketType + selection + line)
    if (verifiedFixture && verifiedMarket) {
      const sportsDupKey = `${analystStr}|${verifiedFixture.eventId}|${verifiedMarket.type}|${verifiedMarket.selection}|${verifiedMarket.line ?? "noline"}`.toLowerCase();
      const existingSports = contentDedupeMap.get(sportsDupKey);
      if (existingSports) {
        return NextResponse.json(
          {
            success: false,
            error: "Anda sudah memiliki prediksi aktif pada pertandingan dan pasar ini.",
            data: existingSports.record,
          },
          { status: 409 }
        );
      }
    }

    // 9. Anchor Checkpoint from Tatum / Sui Gateway (Bagian 3)
    const anchor = await getLatestSuiCheckpointAnchor();

    // 10. Persist structured prediction to Walrus Memory
    const saved = await saveMemory({
      title: finalTitle,
      content:
        typeof content === "string" && content.trim().length > 0
          ? content.trim().slice(0, 500)
          : `Forecast for ${finalTarget}: ${finalPick}`,
      analyst: analystStr,
      target: finalTarget,
      pick: finalPick,
      outcome: sanitizedOutcome,
      credibilityDelta: sanitizedDelta,
      pnl: sanitizedPnl,
      category: "prediction",
      sportType: categoryVal,
      odds: typeof odds === "string" ? odds.trim().slice(0, 20) : "-110",
      stake: stakeVal,
      confidence: confVal,
      reasoning: typeof reasoning === "string" ? reasoning.slice(0, 1000) : undefined,
      tags: extraTags.length > 0 ? extraTags : undefined,
      deadline: parsedDeadlineIso,
      direction: categoryVal === "crypto" ? finalDirection : (direction === "above" || direction === "below" ? direction : undefined),
      targetPrice: categoryVal === "crypto" ? validatedTargetPrice : (typeof targetPrice === "number" && !isNaN(targetPrice) ? targetPrice : undefined),
      asset: categoryVal === "crypto" ? assetStr : (typeof asset === "string" ? asset.trim().slice(0, 20) : undefined),
      suiCheckpoint: anchor.checkpoint,
      suiCheckpointDigest: anchor.digest,
      suiCheckpointSource: anchor.source,
      fixture: verifiedFixture,
      market: verifiedMarket,
    });

    const sourceLabel =
      anchor.source === "tatum-grpc"
        ? " via Tatum gRPC"
        : anchor.source === "tatum-gateway"
        ? " via Tatum gateway"
        : anchor.source === "sui-graphql"
        ? " via Sui GraphQL"
        : "";

    const responsePayload = {
      success: true,
      data: saved,
      status: saved.writeStatus,
      blobId: saved.blobId,
      suiAnchor: anchor.checkpoint ? `#${anchor.checkpoint}${sourceLabel}` : "not anchored",
    };

    if (clientReqId) {
      requestIdCache.set(clientReqId, {
        responsePayload,
        timestamp: now,
      });
    }

    contentDedupeMap.set(contentFingerprint, {
      record: saved,
      timestamp: now,
    });

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
