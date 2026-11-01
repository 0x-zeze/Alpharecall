import type { SportsMarketRef } from "./types";
import { SUPPORTED_LEAGUES } from "./espn";

export interface FinalScore {
  home: number;
  away: number;
}

export type SportsMarketSettlement = "ACCURATE" | "FAILED" | "manual_required";

/**
 * Pure function to settle a sports market based on official final score.
 * - Moneyline: compare home vs away score.
 *   Soccer draw only accurate if selection === 'draw'.
 * - Total: compare sum of scores vs line. Line MUST be a half-number (x.5),
 *   eliminating pushes. If line is integer or invalid, returns manual_required.
 */
export function settleMarket(
  market: SportsMarketRef,
  finalScore: FinalScore
): SportsMarketSettlement {
  if (!market || !finalScore) return "manual_required";

  const home = finalScore.home;
  const away = finalScore.away;
  if (typeof home !== "number" || typeof away !== "number" || isNaN(home) || isNaN(away)) {
    return "manual_required";
  }

  if (market.type === "moneyline") {
    if (home > away) {
      return market.selection === "home" ? "ACCURATE" : "FAILED";
    } else if (away > home) {
      return market.selection === "away" ? "ACCURATE" : "FAILED";
    } else {
      // Tie / Draw
      return market.selection === "draw" ? "ACCURATE" : "FAILED";
    }
  }

  if (market.type === "total") {
    const line = market.line;
    if (typeof line !== "number" || isNaN(line) || Math.abs(line % 1) !== 0.5) {
      return "manual_required"; // Ties / whole numbers are strictly disallowed
    }
    const totalScore = home + away;
    if (market.selection === "over") {
      return totalScore > line ? "ACCURATE" : "FAILED";
    } else if (market.selection === "under") {
      return totalScore < line ? "ACCURATE" : "FAILED";
    }
  }

  return "manual_required";
}

export interface EspnGameStatusResult {
  completed: boolean;
  state: "pre" | "in" | "post";
  statusName?: string;
  statusDescription?: string;
  isOvertimeOrPenalties?: boolean;
  isVoid?: boolean;
  score?: FinalScore;
}

export interface EspnEventStatusType {
  state?: string;
  name?: string;
  completed?: boolean;
  description?: string;
}

export interface EspnScoreboardEvent {
  id?: string;
  status?: {
    type?: EspnEventStatusType;
  };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string | number;
    }>;
  }>;
}

/**
 * Parses raw ESPN scoreboard event to extract final game outcome.
 * Uses scoreboard endpoint matching `dates=YYYYMMDD` and eventId.
 */
export async function fetchEspnGameStatus(
  sport: "nba" | "soccer",
  leagueSlug: string,
  eventId: string,
  kickoffIso: string,
  customFetch: typeof fetch = fetch
): Promise<EspnGameStatusResult | null> {
  const leagueConfig = SUPPORTED_LEAGUES[leagueSlug];
  if (!leagueConfig) return null;

  const dateObj = new Date(kickoffIso);
  if (isNaN(dateObj.getTime())) return null;

  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;

  const url = `https://site.api.espn.com/apis/site/v2/sports/${leagueConfig.espnPath}/scoreboard?dates=${dateStr}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await customFetch(url, {
      headers: { "User-Agent": "WalRecall/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const events: EspnScoreboardEvent[] = Array.isArray(data?.events) ? data.events : [];
    const targetEvent = events.find((e) => String(e.id || "").trim() === eventId);
    if (!targetEvent) return null;

    const statusType = targetEvent.status?.type || {};
    const state = (statusType.state || "pre") as "pre" | "in" | "post";
    const completed = Boolean(statusType.completed);
    const statusName = statusType.name || "";
    const description = statusType.description || "";

    // Check if match was cancelled, postponed, or suspended
    const lowerDesc = `${statusName} ${description}`.toLowerCase();
    if (
      lowerDesc.includes("cancel") ||
      lowerDesc.includes("postpone") ||
      lowerDesc.includes("suspend") ||
      lowerDesc.includes("forfeit")
    ) {
      return {
        completed: true,
        state: "post",
        statusName,
        statusDescription: description,
        isVoid: true,
      };
    }

    if (state !== "post" || !completed) {
      return {
        completed: false,
        state,
        statusName,
        statusDescription: description,
      };
    }

    // In soccer, check if game went to Extra Time or Penalty Shootout
    let isOvertimeOrPenalties = false;
    if (sport === "soccer") {
      if (
        lowerDesc.includes("extra") ||
        lowerDesc.includes("penalt") ||
        lowerDesc.includes("aet") ||
        lowerDesc.includes("pen")
      ) {
        isOvertimeOrPenalties = true;
      }
    }

    const competition = Array.isArray(targetEvent.competitions) ? targetEvent.competitions[0] : null;
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];

    let homeScore: number | null = null;
    let awayScore: number | null = null;

    for (const c of competitors) {
      const s = parseInt(String(c.score || ""), 10);
      if (!isNaN(s)) {
        if (c.homeAway === "home") homeScore = s;
        else if (c.homeAway === "away") awayScore = s;
      }
    }

    if (homeScore === null || awayScore === null) {
      return null;
    }

    return {
      completed: true,
      state: "post",
      statusName,
      statusDescription: description,
      isOvertimeOrPenalties,
      isVoid: false,
      score: {
        home: homeScore,
        away: awayScore,
      },
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
