import { NextResponse } from "next/server";
import { saveMemory } from "@/lib/walrus";


const SEED_BATCH = [
  {
    category: "audit" as const,
    title: "MLB G1: Los Angeles Dodgers vs New York Yankees",
    content: "Dodgers moneyline hit via historic walk-off grand slam. Odds closed at -132. Walrus memory updated.",
    analyst: "@DodgerBlueStats",
    target: "MLB LAD vs NYY",
    pick: "LAD Moneyline",
    outcome: "ACCURATE" as const,
    credibilityDelta: 6,
  },
  {
    category: "audit" as const,
    title: "SUI Token Breakout past $2.20",
    content: "Onchain Oracle & Tatum RPC confirmed SUI peak at $2.36. Volume spike exceeded 450M.",
    analyst: "@CryptoSuiAlpha",
    target: "SUI/USDT",
    pick: "LONG > $2.20",
    outcome: "ACCURATE" as const,
    credibilityDelta: 8,
  },
  {
    category: "audit" as const,
    title: "Arsenal FC vs Chelsea FC: Over 2.5 Goals",
    content: "Match ended 2-1 (3 total goals). Model weighted Arsenal home xG accurately.",
    analyst: "@EPLFootyPicks",
    target: "ARS vs CHE",
    pick: "OVER 2.5",
    outcome: "ACCURATE" as const,
    credibilityDelta: 5,
  },
  {
    category: "audit" as const,
    title: "Sui Network TVL Inflow Crosses $1B",
    content: "DeFi protocols on Sui reached milestone. Credibility score for ecosystem analyst increased.",
    analyst: "@DeFiScannerSui",
    target: "Sui Network TVL",
    pick: "TVL > $1.0B",
    outcome: "ACCURATE" as const,
    credibilityDelta: 7,
  },
  {
    category: "audit" as const,
    title: "NBA: Boston Celtics -6.5 vs Miami Heat",
    content: "Boston won by 14 points (119-105). 3-point conversion variance was positive.",
    analyst: "@HoopSharps",
    target: "BOS vs MIA",
    pick: "BOS -6.5",
    outcome: "ACCURATE" as const,
    credibilityDelta: 5,
  },
  {
    category: "audit" as const,
    title: "BTC/USDT Breakout $68,500",
    content: "Bitcoin tested upper boundary before election rally. Liquidation cascade confirmed onchain.",
    analyst: "@MacroCryptoSage",
    target: "BTC/USDT",
    pick: "BREAKOUT $68.5k",
    outcome: "ACCURATE" as const,
    credibilityDelta: 6,
  },
  {
    category: "audit" as const,
    title: "MLB NLCS Game 6: Dodgers vs Mets Over 8.5",
    content: "Total runs reached 15. Pitching fatigue in bullpen accurately forecasted.",
    analyst: "@DodgerBlueStats",
    target: "NYM vs LAD",
    pick: "OVER 8.5",
    outcome: "ACCURATE" as const,
    credibilityDelta: 5,
  },
  {
    category: "audit" as const,
    title: "ETH/BTC Ratio Fall Under 0.038",
    content: "Layer-1 capital rotation away from ETH confirmed. Tatum RPC verified transaction flow.",
    analyst: "@MacroCryptoSage",
    target: "ETH/BTC",
    pick: "RATIO < 0.038",
    outcome: "ACCURATE" as const,
    credibilityDelta: 6,
  },
  {
    category: "audit" as const,
    title: "La Liga: Real Madrid vs Barcelona (El Clasico)",
    content: "Barcelona 4-0 away win. Real Madrid failed to score. Negative delta applied to analyst.",
    analyst: "@EPLFootyPicks",
    target: "RMA vs FCB",
    pick: "RMA DNB",
    outcome: "FAILED" as const,
    credibilityDelta: -7,
  },
  {
    category: "analyst_score" as const,
    title: "Autonomous Memory Recalibration: Forecaster Trust Score",
    content: "AlphaRecall learned that @DodgerBlueStats has 92% reliability, boosting future algorithmic weighting to 2.4x. Sports models have adapted permanently.",
    analyst: "AlphaRecall Consensus AI",
    target: "Consensus Model",
    pick: "SYSTEM_RECALIBRATE",
    outcome: "ACCURATE" as const,
    credibilityDelta: 10,
  },
];

export async function POST() {
  try {
    const results = [];
    for (const item of SEED_BATCH) {
      const saved = await saveMemory(item);
      results.push(saved);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${results.length} memories to Walrus Memory!`,
      count: results.length,
      data: results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
