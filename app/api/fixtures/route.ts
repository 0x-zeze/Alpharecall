import { NextRequest, NextResponse } from "next/server";
import { getUpcomingFixtures } from "@/lib/fixtures";
import { SUPPORTED_LEAGUES } from "@/lib/espn";

// In-memory rate limiting per IP (60 requests / minute)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateLimitBucket>();
const MAX_REQUESTS_PER_MINUTE = 60;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Max 60 requests per minute." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport");
    const league = searchParams.get("league") || (sport === "nba" ? "nba" : "eng.1");
    const daysRaw = searchParams.get("days");

    if (sport !== "nba" && sport !== "soccer") {
      return NextResponse.json(
        { ok: false, error: "Invalid sport parameter. Must be 'nba' or 'soccer'." },
        { status: 400 }
      );
    }

    const leagueConfig = SUPPORTED_LEAGUES[league];
    if (!leagueConfig || leagueConfig.sport !== sport) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid or unsupported league '${league}' for sport '${sport}'.`,
        },
        { status: 400 }
      );
    }

    let days = 7;
    if (daysRaw) {
      const parsedDays = parseInt(daysRaw, 10);
      if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 7) {
        return NextResponse.json(
          { ok: false, error: "Days parameter must be an integer between 1 and 7." },
          { status: 400 }
        );
      }
      days = parsedDays;
    }

    const result = await getUpcomingFixtures({ sport, league, days });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch fixtures from ESPN public scoreboard (unofficial).",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        sport: result.sport,
        league: result.league,
        leagueLabel: result.leagueLabel,
        fixtures: result.fixtures,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Internal server error fetching fixtures." },
      { status: 500 }
    );
  }
}
