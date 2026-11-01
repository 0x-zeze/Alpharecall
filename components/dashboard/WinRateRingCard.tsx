"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";

interface WinRateRingCardProps {
  winRate: number;
  wins: number;
  losses: number;
  pending: number;
  liveCount: number;
  backtestCount: number;
}

export function WinRateRingCard({
  winRate,
  wins,
  losses,
  pending,
  liveCount,
  backtestCount,
}: WinRateRingCardProps) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.1} className="flex flex-col justify-between">
      <BentoHeader
        title="Win Rate"
        subtitle="Resolved picks hit percentage"
      />

      <div className="flex items-center justify-between my-2">
        {/* SVG Radial Ring */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background Track */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="var(--glass-surface-3)"
              strokeWidth="9"
              fill="transparent"
            />
            {/* Active Win Rate Arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="url(#winGradient)"
              strokeWidth="9"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: "drop-shadow(0 0 6px var(--win))" }}
            />
            <defs>
              <linearGradient id="winGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--win)" />
                <stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold font-mono-num text-[var(--text)]">
              <AnimatedNumber value={winRate} decimals={1} suffix="%" />
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono-num uppercase">Accuracy</span>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="space-y-2 text-xs font-mono-num pl-4">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--win)]" />
              Wins
            </span>
            <span className="font-bold text-[var(--text)]">{wins}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--loss)]" />
              Losses
            </span>
            <span className="font-bold text-[var(--text)]">{losses}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--pending)]" />
              Open
            </span>
            <span className="font-bold text-[var(--text)]">{pending}</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Sample: {wins + losses} resolved</span>
        <span>
          {liveCount} live · {backtestCount} backtest
        </span>
      </div>
    </BentoCard>
  );
}
