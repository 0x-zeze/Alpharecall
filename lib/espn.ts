/**
 * Whitelist and types for ESPN sports and leagues.
 */

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  logo: string | null;
}

export interface Fixture {
  provider: "espn";
  eventId: string;
  sport: "nba" | "soccer";
  league: string;
  leagueLabel: string;
  kickoff: string; // ISO UTC string
  status: "scheduled";
  home: TeamInfo;
  away: TeamInfo;
  venue?: string;
}

export interface LeagueConfig {
  slug: string;
  sport: "nba" | "soccer";
  label: string;
  espnPath: string; // e.g. "basketball/nba" or "soccer/eng.1"
}

export const SUPPORTED_LEAGUES: Record<string, LeagueConfig> = {
  nba: {
    slug: "nba",
    sport: "nba",
    label: "NBA",
    espnPath: "basketball/nba",
  },
  "eng.1": {
    slug: "eng.1",
    sport: "soccer",
    label: "Premier League",
    espnPath: "soccer/eng.1",
  },
  "esp.1": {
    slug: "esp.1",
    sport: "soccer",
    label: "LaLiga",
    espnPath: "soccer/esp.1",
  },
  "ger.1": {
    slug: "ger.1",
    sport: "soccer",
    label: "Bundesliga",
    espnPath: "soccer/ger.1",
  },
  "ita.1": {
    slug: "ita.1",
    sport: "soccer",
    label: "Serie A",
    espnPath: "soccer/ita.1",
  },
  "fra.1": {
    slug: "fra.1",
    sport: "soccer",
    label: "Ligue 1",
    espnPath: "soccer/fra.1",
  },
  "uefa.champions": {
    slug: "uefa.champions",
    sport: "soccer",
    label: "Champions League",
    espnPath: "soccer/uefa.champions",
  },
  "usa.1": {
    slug: "usa.1",
    sport: "soccer",
    label: "MLS",
    espnPath: "soccer/usa.1",
  },
};

export const ALLOWED_LOGO_HOST = "a.espncdn.com";

/**
 * Validates whether an image URL is from the allowed ESPN CDN.
 * Returns the URL if valid and https, or null otherwise.
 */
export function validateLogoUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "https:" && parsed.hostname === ALLOWED_LOGO_HOST) {
      return parsed.toString();
    }
  } catch {
    // Malformed URL
  }
  return null;
}

export interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  team?: {
    id?: string;
    displayName?: string;
    name?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
}

export interface EspnEvent {
  id?: string;
  date?: string;
  status?: {
    type?: {
      state?: string;
      name?: string;
      completed?: boolean;
      description?: string;
    };
  };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    venue?: {
      fullName?: string;
    };
  }>;
}

/**
 * Parses raw ESPN scoreboard event items safely and tolerantly.
 * Discards past/in-play events or games kicking off within 10 minutes.
 */
export function parseEspnEvent(
  rawEvent: unknown,
  sport: "nba" | "soccer",
  leagueSlug: string,
  leagueLabel: string,
  nowMs: number = Date.now()
): Fixture | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const ev = rawEvent as EspnEvent;

  const eventId = String(ev.id || "").trim();
  if (!eventId || !/^[A-Za-z0-9_-]{1,32}$/.test(eventId)) return null;

  const dateStr = String(ev.date || "").trim();
  const kickoffMs = Date.parse(dateStr);
  if (isNaN(kickoffMs)) return null;

  // Strict invariant: only scheduled matches with kickoff > now + 10 minutes
  const MIN_KICKOFF_BUFFER_MS = 10 * 60 * 1000; // 10 minutes
  if (kickoffMs <= nowMs + MIN_KICKOFF_BUFFER_MS) return null;

  // Verify status state is "pre" (scheduled)
  const statusState = ev.status?.type?.state;
  if (statusState && statusState !== "pre") return null;

  const competition = Array.isArray(ev.competitions) ? ev.competitions[0] : null;
  if (!competition || !Array.isArray(competition.competitors)) return null;

  let homeComp: EspnCompetitor | null = null;
  let awayComp: EspnCompetitor | null = null;

  for (const c of competition.competitors) {
    if (c.homeAway === "home") homeComp = c;
    else if (c.homeAway === "away") awayComp = c;
  }

  // Fallback if homeAway is missing but 2 competitors exist
  if (!homeComp && competition.competitors.length >= 2) {
    homeComp = competition.competitors[0];
    awayComp = competition.competitors[1];
  }

  if (!homeComp?.team || !awayComp?.team) return null;

  const cleanString = (val: unknown, maxLen = 60): string => {
    if (typeof val !== "string") return "";
    return val.replace(/\s+/g, " ").trim().slice(0, maxLen);
  };

  const parseTeam = (comp: EspnCompetitor): TeamInfo => {
    const t = comp.team || {};
    const name = cleanString(t.displayName || t.name || "Unknown Team", 60);
    const shortName = cleanString(t.shortDisplayName || name, 40);
    const abbr = cleanString(t.abbreviation || shortName.slice(0, 4).toUpperCase(), 10);
    const logo = validateLogoUrl(t.logo);
    return {
      id: cleanString(String(t.id || ""), 32),
      name,
      shortName,
      abbr,
      logo,
    };
  };

  const home = parseTeam(homeComp);
  const away = parseTeam(awayComp);

  let venue: string | undefined = undefined;
  if (competition.venue?.fullName && typeof competition.venue.fullName === "string") {
    venue = cleanString(competition.venue.fullName, 80);
  }

  return {
    provider: "espn",
    eventId,
    sport,
    league: leagueSlug,
    leagueLabel,
    kickoff: new Date(kickoffMs).toISOString(),
    status: "scheduled",
    home,
    away,
    venue,
  };
}
