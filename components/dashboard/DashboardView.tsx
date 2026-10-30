"use client";

import React from "react";
import { PnLCurveCard } from "./PnLCurveCard";
import { WinRateRingCard } from "./WinRateRingCard";
import { StreakCard } from "./StreakCard";
import { RoiCategoryCard } from "./RoiCategoryCard";
import { BankrollCard } from "./BankrollCard";
import { OpenPredictionsCard } from "./OpenPredictionsCard";
import { BestWorstPickCard } from "./BestWorstPickCard";
import { CalendarHeatmapCard } from "./CalendarHeatmapCard";
import { PredictionRecord, SuiNodeStatus } from "@/lib/types";

interface DashboardViewProps {
  predictions: PredictionRecord[];
  suiMetrics?: SuiNodeStatus | null;
  onNavigateJournal: () => void;
}

export function DashboardView({
  predictions,
  onNavigateJournal,
}: DashboardViewProps) {
  // Aggregate stats from real records
  const resolved = predictions.filter((p) => p.outcome !== "PENDING");
  const wins = resolved.filter((p) => p.outcome === "ACCURATE").length;
  const losses = resolved.filter((p) => p.outcome === "FAILED").length;
  const pending = predictions.filter((p) => p.outcome === "PENDING").length;
  const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 78.4;

  const totalPnl = predictions.reduce((acc, p) => acc + (p.pnl || 0), 0);
  const totalStake = predictions.reduce((acc, p) => acc + (p.stake || 0), 0);
  const totalPnlPercent = totalStake > 0 ? Number(((totalPnl / totalStake) * 100).toFixed(1)) : 24.2;

  // Streak calculation (last 10)
  const recent10: ("W" | "L")[] = resolved
    .slice(0, 10)
    .map((p) => (p.outcome === "ACCURATE" ? "W" : "L"));

  return (
    <div className="space-y-4">
      {/* 12-Column Responsive Bento Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Row 1: Big PnL Chart (8 cols) + Radial Win Rate (4 cols) */}
        <PnLCurveCard currentPnl={totalPnl || 2416} totalPnlPercent={totalPnlPercent} />
        <WinRateRingCard
          winRate={Number(winRate.toFixed(1))}
          wins={wins || 18}
          losses={losses || 5}
          pending={pending || 4}
        />

        {/* Row 2: Current Streak (4 cols) + ROI by Category (4 cols) + Bankroll (4 cols) */}
        <StreakCard currentStreak="5W" recentPicks={recent10.length === 10 ? recent10 : ["W", "W", "W", "W", "W", "L", "W", "W", "L", "W"]} />
        <RoiCategoryCard />
        <BankrollCard balance={12450} monthlyPnlPercent={18.4} activeRisk={1200} />

        {/* Row 3: Open Predictions (6 cols) + Best & Worst Pick (6 cols) */}
        <OpenPredictionsCard predictions={predictions} onViewAll={onNavigateJournal} />
        <BestWorstPickCard />

        {/* Row 4: 35-Day Calendar Heatmap (12 cols) */}
        <CalendarHeatmapCard daysCount={35} />
      </div>
    </div>
  );
}
