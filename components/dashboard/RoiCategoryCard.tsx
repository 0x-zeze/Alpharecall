"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import type { PredictionRecord } from "@/lib/types";

const COLORS: Record<string, string> = {
  crypto: "var(--accent)",
  soccer: "#a855f7",
  nba: "#f97316",
  sports: "#22c55e",
};

export function RoiCategoryCard({ predictions = [] }: { predictions?: PredictionRecord[] }) {
  const buckets = new Map<string, { pnl: number; stake: number; picks: number }>();
  for (const record of predictions) {
    if (record.outcome === "PENDING") continue;
    const key = record.sportType;
    const current = buckets.get(key) || { pnl: 0, stake: 0, picks: 0 };
    current.pnl += record.pnl || 0;
    current.stake += record.stake || 0;
    current.picks += 1;
    buckets.set(key, current);
  }

  const categories = Array.from(buckets.entries()).map(([name, value]) => ({
    name,
    roi: value.stake > 0 ? Number(((value.pnl / value.stake) * 100).toFixed(1)) : 0,
    pnl: value.pnl,
    color: COLORS[name] || "var(--accent)",
    picksCount: value.picks,
  }));

  const totalPnl = categories.reduce((sum, item) => sum + item.pnl, 0);
  const totalStake = Array.from(buckets.values()).reduce((sum, item) => sum + item.stake, 0);
  const combined = totalStake > 0 ? Number(((totalPnl / totalStake) * 100).toFixed(1)) : 0;

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.2} className="flex flex-col justify-between">
      <BentoHeader
        title="ROI by Sector"
        subtitle="From resolved records only. Simulated PnL."
      />

      <div className="space-y-3.5 my-1">
        {categories.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No resolved records.</p>
        ) : (
          categories.map((cat) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono-num">
                <span className="text-[var(--text)] font-medium capitalize">{cat.name}</span>
                <span className={`font-bold ${cat.roi >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"}`}>
                  {cat.roi >= 0 ? "+" : ""}
                  <AnimatedNumber value={cat.roi} decimals={1} suffix="%" />
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.abs(cat.roi), 100)}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono-num">
                <span>{cat.picksCount} resolved</span>
                <span>{cat.pnl >= 0 ? "+" : "-"}${Math.abs(cat.pnl).toLocaleString()} simulated</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Combined resolved ROI</span>
        <span className="text-[var(--accent)] font-semibold">{combined >= 0 ? "+" : ""}{combined}%</span>
      </div>
    </BentoCard>
  );
}
