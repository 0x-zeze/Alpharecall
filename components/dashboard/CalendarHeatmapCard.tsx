"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";

interface CalendarHeatmapCardProps {
  daysCount?: number; // 35 days (5 weeks)
}

export function CalendarHeatmapCard({ daysCount = 35 }: CalendarHeatmapCardProps) {
  // Generate last 35 days with realistic outcomes
  const days = Array.from({ length: daysCount }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysCount - 1 - i));
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // deterministic realistic performance: most weekend/match days have wins or losses
    let status: "win" | "loss" | "flat" = "flat";
    let pnl = 0;

    if (i % 3 === 0 || i % 7 === 1) {
      status = "win";
      pnl = 180 + (i % 5) * 60;
    } else if (i % 5 === 2) {
      status = "loss";
      pnl = -120 - (i % 3) * 50;
    }

    return { dateStr, status, pnl, dayOfWeek };
  });

  return (
    <BentoCard colSpan="col-span-12" delay={0.4} className="flex flex-col justify-between">
      <BentoHeader
        title="Daily Resolution Activity Heatmap"
        subtitle="Tracking daily prediction profitability and volume across the last 5 weeks"
        action={
          <div className="flex items-center gap-2 text-[10px] font-mono-num text-[var(--muted)]">
            <span>Less</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--border)]" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--win-bg)] border border-[var(--win)]/40" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--win)]" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--loss)]" />
            </div>
            <span>More</span>
          </div>
        }
      />

      <div className="my-2 overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-[500px]">
          {days.map((day, idx) => (
            <div
              key={idx}
              title={`${day.dateStr}: ${
                day.status === "win"
                  ? `+$${day.pnl}`
                  : day.status === "loss"
                  ? `-$${Math.abs(day.pnl)}`
                  : "No resolutions"
              }`}
              className={`flex-1 h-9 rounded-[6px] border transition-transform hover:scale-105 cursor-default flex items-center justify-center text-[9px] font-mono-num ${
                day.status === "win"
                  ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30 font-semibold"
                  : day.status === "loss"
                  ? "bg-[var(--loss-bg)] text-[var(--loss)] border-[var(--loss)]/30 font-semibold"
                  : "bg-[var(--border-subtle)] text-[var(--muted)] border-transparent"
              }`}
            >
              {day.status === "win" ? "✓" : day.status === "loss" ? "✕" : "·"}
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Active Trading Days: 26 / 35</span>
        <span className="text-[var(--win)] font-semibold">Positive Days: 76.9%</span>
      </div>
    </BentoCard>
  );
}
