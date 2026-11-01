export type PredictionCategory = "soccer" | "nba" | "crypto" | "sports";
export type PredictionStatus = "PENDING" | "ACCURATE" | "FAILED";
export type MemoryWriteStatus = "confirmed" | "pending" | "failed" | "local-demo";

export interface SportsTeamRef {
  id: string;
  name: string;
  abbr?: string;
  logo?: string | null;
}

export interface SportsFixtureRef {
  provider: "espn";
  eventId: string;
  sport: "nba" | "soccer";
  league: string;
  leagueLabel: string;
  kickoff: string; // ISO-8601 string
  home: SportsTeamRef;
  away: SportsTeamRef;
}

export interface SportsMarketRef {
  type: "moneyline" | "total";
  selection: "home" | "away" | "draw" | "over" | "under";
  line?: number;
}

export interface PredictionRecord {
  id: string;
  category: "prediction" | "audit" | "analyst_score" | "market_insight";
  sportType: PredictionCategory;
  title: string;
  content: string;
  analyst: string;
  target: string;
  pick: string;
  odds: string;
  stake: number;
  pnl: number;
  outcome: PredictionStatus;
  credibilityDelta: number;
  confidence: number; // 1 to 5
  timestamp: number;
  dateStr: string;
  blobId?: string; // Honest Walrus Mainnet blob ID (only when confirmed)
  writeStatus: MemoryWriteStatus; // "confirmed" | "pending" | "failed" | "local-demo"
  writeError?: string;
  source?: "demo" | "walrus";
  leagueOrAsset?: string;
  reasoning?: string;
  postMortem?: string;
  tags?: string[];

  // BAGIAN 2: Optional Forecast Target & Deadline fields
  deadline?: string; // ISO-8601 string, e.g. "2026-11-01T00:00:00.000Z"
  direction?: "above" | "below";
  targetPrice?: number;
  asset?: string; // e.g. "SUI", "BTC", "ETH"

  // BAGIAN 3: Optional Sui Anchor fields
  suiCheckpoint?: string | null;
  suiCheckpointDigest?: string | null;
  suiCheckpointSource?: "tatum-grpc" | "tatum-gateway" | "sui-graphql" | null;
  oracleFallbackUsed?: boolean;

  // FASE C: Optional Structured Sports Fixture & Market fields
  fixture?: SportsFixtureRef;
  market?: SportsMarketRef;
}

export interface ForecasterStats {
  handle: string;
  name: string;
  avatarText: string;
  category: string;
  totalPicks: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  streak: ("W" | "L")[];
  credibilityScore: number;
  weightMultiplier: number; // 0.40x to 2.40x
  avgOdds: string;
  totalPnl: number;
  verifiedWalrusBlobs: number;
}

export interface BankrollStats {
  currentBalance: number;
  startingBalance: number;
  netPnl: number;
  pnlPercent: number;
  totalStaked: number;
  roi: number;
  peakBalance: number;
  maxDrawdown: number;
  activeRisk: number;
}

export interface TatumGatewayStatus {
  ok: boolean;
  status: "live" | "unavailable";
  plan: string | null;
  creditLimit: number | null;
  usage: number | null;
  latencyMs: number | null;
  version: string | null;
  error?: string | null;
}

export type SuiCheckpointSource = "tatum-grpc" | "tatum-gateway" | "sui-graphql";

export interface SuiChainStatus {
  ok: boolean;
  status: "live" | "unavailable";
  checkpoint: string | null;
  checkpointDigest: string | null;
  epoch: string | null;
  referenceGasPrice: string | null;
  chainId: string | null;
  latencyMs: number | null;
  rpcUrl: string;
  isTatumGateway: boolean;
  source: SuiCheckpointSource | null;
  gatewayWarning?: string | null;
  error?: string | null;
}

// Backward-compatible alias for existing components
export interface SuiNodeStatus extends SuiChainStatus {
  errorMessage?: string;
}

export interface PredictionResolutionResult {
  predictionId: string;
  resolved: boolean;
  outcome?: "ACCURATE" | "FAILED" | "PENDING";
  currentValue?: number | string;
  targetValue?: number | string;
  proofType: "tatum_sui_rpc" | "crypto_oracle_price" | "sports_settlement";
  proofDetail: string;
  timestamp: number;
}
