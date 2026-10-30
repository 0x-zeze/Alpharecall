export type PredictionCategory = "soccer" | "nba" | "crypto" | "sports";
export type PredictionStatus = "PENDING" | "ACCURATE" | "FAILED";
export type MemoryWriteStatus = "confirmed" | "pending" | "failed" | "local-demo";

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

export interface SuiNodeStatus {
  status: "live" | "unavailable";
  checkpoint: string | null;
  epoch: string | null;
  referenceGasPrice: string | null;
  chainIdentifier: string | null;
  latencyMs: number | null;
  isTatumGateway: boolean;
  rpcUrl: string;
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
