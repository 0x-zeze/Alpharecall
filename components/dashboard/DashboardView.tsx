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
import {
  SIMULATED_STARTING_BANKROLL,
  activeRisk,
  avgStakeOfBankrollPercent,
  countLiveVsBacktest,
  currentWinStreak,
  simulatedBalance,
} from "@/lib/dashboard-stats";

interface DashboardViewProps {
  predictions: PredictionRecord[];
  suiMetrics?: SuiNodeStatus | null;
  onNavigateJournal: () => void;
}

export function DashboardView({
  predictions,
  onNavigateJournal,
}: DashboardViewProps) {
  const resolved = predictions.filter((p) => p.outcome !== "PENDING");
  const wins = resolved.filter((p) => p.outcome === "ACCURATE").length;
  const losses = resolved.filter((p) => p.outcome === "FAILED").length;
  const pending = predictions.filter((p) => p.outcome === "PENDING").length;
  const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;

  const totalPnl = resolved.reduce((acc, p) => acc + (p.pnl || 0), 0);
  const totalStake = resolved.reduce((acc, p) => acc + (p.stake || 0), 0);
  const totalPnlPercent = totalStake > 0 ? Number(((totalPnl / totalStake) * 100).toFixed(1)) : 0;

  const recent10: ("W" | "L")[] = resolved
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((p) => (p.outcome === "ACCURATE" ? "W" : "L"));

  const streak = currentWinStreak(predictions);
  const sample = countLiveVsBacktest(predictions);
  const balance = simulatedBalance(predictions);
  const pnlPercent =
    SIMULATED_STARTING_BANKROLL > 0
      ? Number((((balance - SIMULATED_STARTING_BANKROLL) / SIMULATED_STARTING_BANKROLL) * 100).toFixed(1))
      : 0;

  const best = resolved.slice().sort((a, b) => (b.pnl || 0) - (a.pnl || 0))[0];
  const worst = resolved.slice().sort((a, b) => (a.pnl || 0) - (b.pnl || 0))[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <PnLCurveCard currentPnl={totalPnl} totalPnlPercent={totalPnlPercent} />
        <WinRateRingCard
          winRate={Number(winRate.toFixed(1))}
          wins={wins}
          losses={losses}
          pending={pending}
          liveCount={sample.live}
          backtestCount={sample.backtest}
        />
        <StreakCard currentStreak={`${streak}W`} recentPicks={recent10} hotRun={streak >= 3} />
        <RoiCategoryCard predictions={predictions} />
        <BankrollCard
          balance={balance}
          startingBalance={SIMULATED_STARTING_BANKROLL}
          monthlyPnlPercent={pnlPercent}
          activeRisk={activeRisk(predictions)}
          avgStakePercent={avgStakeOfBankrollPercent(predictions)}
        />
        <OpenPredictionsCard predictions={predictions} onViewAll={onNavigateJournal} />
        <BestWorstPickCard bestPick={best} worstPick={worst} />
        <CalendarHeatmapCard daysCount={35} />
      </div>
    </div>
  );
}
