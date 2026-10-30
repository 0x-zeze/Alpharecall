export type PredictionCategory = "soccer" | "nba" | "crypto" | "sports";
export type PredictionStatus = "PENDING" | "ACCURATE" | "FAILED";

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
  mainnetCommitHash?: string;
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
  weightMultiplier: number; // 0.4x to 2.2x
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
  checkpoint: string;
  epoch: string;
  referenceGasPrice: string;
  chainIdentifier: string;
  latencyMs: number;
  isTatumGateway: boolean;
  rpcUrl: string;
}
