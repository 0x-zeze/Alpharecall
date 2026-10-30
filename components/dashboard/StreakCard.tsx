"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { Flame } from "lucide-react";

interface StreakCardProps {
  currentStreak: string; // e.g. "5W"
  recentPicks: ("W" | "L")[]; // length 10
}

export function StreakCard({ currentStreak = "5W", recentPicks = ["W", "W", "W", "W", "W", "L", "W", "W", "L", "W"] }: StreakCardProps) {
  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.15} className="flex flex-col justify-between">
      <BentoHeader
        title="Current Streak"
        subtitle="Recent 10 prediction outcomes"
        action={
          <div className="flex items-center gap-1 text-[11px] font-mono-num font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <Flame className="w-3 h-3 fill-amber-500" />
            <span>Hot Run</span>
          </div>
        }
      />

      <div className="my-2">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold font-mono-num text-[var(--win)] tracking-tight">
            {currentStreak}
          </span>
          <span className="text-xs text-[var(--muted)] font-mono-num">Consecutive Hits</span>
        </div>

        {/* 10 W/L dots */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {recentPicks.map((res, i) => (
            <div
              key={i}
              title={`Pick #${10 - i}: ${res === "W" ? "Win" : "Loss"}`}
              className={`w-7 h-7 rounded-[8px] flex items-center justify-center text-[11px] font-bold font-mono-num transition-transform hover:scale-110 cursor-default ${
                res === "W"
                  ? "bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/30"
                  : "bg-[var(--loss-bg)] text-[var(--loss)] border border-[var(--loss)]/30"
              }`}
            >
              {res}
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Variance Index: Low</span>
        <span className="text-[var(--text)]">Last Loss: Oct 24</span>
      </div>
    </BentoCard>
  );
}
