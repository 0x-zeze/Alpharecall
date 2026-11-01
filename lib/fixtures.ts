import {
  SUPPORTED_LEAGUES,
  parseEspnEvent,
} from "./espn";
import type { Fixture, LeagueConfig } from "./espn";

export interface FixturesCacheEntry {
  fixtures: Fixture[];
  fetchedAt: number;
}

// In-memory cache per sport+league+days
const fixturesCache = new Map<string, FixturesCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes stale-on-error limit

/**
 * Format a Date object to YYYYMMDD string in UTC
 */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export interface FetchFixturesOptions {
  sport: "nba" | "soccer";
  league?: string;
  days?: number;
  customFetch?: typeof fetch;
}

export interface FetchFixturesResult {
  ok: boolean;
  sport: "nba" | "soccer";
  league: string;
  leagueLabel: string;
  fetchedAt: number;
  stale: boolean;
  fixtures: Fixture[];
  error?: string;
}

/**
 * Fetch and parse upcoming fixtures from ESPN scoreboard.
 * Implements 5-minute in-memory caching and stale-on-error up to 30 minutes.
 */
export async function getUpcomingFixtures(
  options: FetchFixturesOptions
): Promise<FetchFixturesResult> {
  const sport = options.sport;
  const leagueKey = sport === "nba" ? "nba" : (options.league || "eng.1");
  const leagueConfig: LeagueConfig | undefined = SUPPORTED_LEAGUES[leagueKey];

  if (!leagueConfig || leagueConfig.sport !== sport) {
    return {
      ok: false,
      sport,
      league: leagueKey,
      leagueLabel: "Unsupported",
      fetchedAt: Date.now(),
      stale: false,
      fixtures: [],
      error: `Unsupported sport/league combination: ${sport}/${leagueKey}`,
    };
  }

  const days = Math.min(7, Math.max(1, options.days || 7));
  const cacheKey = `${sport}:${leagueKey}:${days}`;
  const now = Date.now();

  const cached = fixturesCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      ok: true,
      sport,
      league: leagueKey,
      leagueLabel: leagueConfig.label,
      fetchedAt: cached.fetchedAt,
      stale: false,
      fixtures: cached.fixtures,
    };
  }

  const fetchFn = options.customFetch || fetch;

  // Build dates query: query each date up to `days`
  // ESPN scoreboard accepts dates=YYYYMMDD
  const datesToFetch: string[] = [];
  const baseDate = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    datesToFetch.push(formatDateYYYYMMDD(d));
  }

  const allFixtures: Fixture[] = [];
  const seenEventIds = new Set<string>();
  let hasAnySuccess = false;

  try {
    for (const dateStr of datesToFetch) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${leagueConfig.espnPath}/scoreboard?dates=${dateStr}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetchFn(url, {
          headers: { "User-Agent": "AlphaRecall/1.0 (Hackathon Predictor)" },
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          hasAnySuccess = true;
          const data = await res.json();
          const events = Array.isArray(data?.events) ? data.events : [];
          for (const rawEv of events) {
            const parsed = parseEspnEvent(rawEv, sport, leagueKey, leagueConfig.label, now);
            if (parsed && !seenEventIds.has(parsed.eventId)) {
              seenEventIds.add(parsed.eventId);
              allFixtures.push(parsed);
            }
          }
        }
      } catch {
        clearTimeout(timeoutId);
        // Continue to next date
      }
    }

    if (!hasAnySuccess && allFixtures.length === 0) {
      throw new Error("ESPN public scoreboard unreachable");
    }

    // Sort by kickoff ascending
    allFixtures.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    const capped = allFixtures.slice(0, 80);

    fixturesCache.set(cacheKey, {
      fixtures: capped,
      fetchedAt: now,
    });

    return {
      ok: true,
      sport,
      league: leagueKey,
      leagueLabel: leagueConfig.label,
      fetchedAt: now,
      stale: false,
      fixtures: capped,
    };
  } catch (err: unknown) {
    // Stale-on-error fallback
    if (cached && now - cached.fetchedAt < STALE_MAX_AGE_MS) {
      return {
        ok: true,
        sport,
        league: leagueKey,
        leagueLabel: leagueConfig.label,
        fetchedAt: cached.fetchedAt,
        stale: true,
        fixtures: cached.fixtures,
      };
    }

    const errMsg = err instanceof Error ? err.message : "Failed to fetch fixtures from ESPN";
    return {
      ok: false,
      sport,
      league: leagueKey,
      leagueLabel: leagueConfig.label,
      fetchedAt: now,
      stale: false,
      fixtures: [],
      error: errMsg,
    };
  }
}

/**
 * Single fixture verification helper used during prediction creation.
 */
export async function getVerifiedFixtureById(
  sport: "nba" | "soccer",
  league: string,
  eventId: string,
  customFetch?: typeof fetch
): Promise<Fixture | null> {
  const result = await getUpcomingFixtures({ sport, league, days: 7, customFetch });
  if (!result.ok || !result.fixtures) return null;
  return result.fixtures.find((f) => f.eventId === eventId) || null;
}
