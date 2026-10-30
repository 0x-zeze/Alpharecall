"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PredictionRecord } from "@/lib/types";

interface BestWorstPickCardProps {
  bestPick?: PredictionRecord;
  worstPick?: PredictionRecord;
}

export function BestWorstPickCard({ bestPick, worstPick }: BestWorstPickCardProps) {
  return (
    <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.35} className="flex flex-col justify-between">
      <BentoHeader
        title="Best & Worst Pick of the Month"
        subtitle="Outlier variance audits stored in Walrus Memory"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
        {/* Best Pick */}
        <div className="p-3.5 rounded-[10px] bg-[var(--win-bg)] border border-[var(--win)]/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-bold text-[var(--win)] uppercase text-[10px]">
              <TrendingUp className="w-3.5 h-3.5" />
              Highest Gain
            </span>
            <span className="font-bold text-[var(--win)]">+$580 PnL</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)]">SUI/USDT Breakout &gt; $2.00</h4>
            <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
              Logged 48h prior to 18% DEX expansion. Confirmed peak at $2.36.
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1 flex justify-between border-t border-[var(--win)]/15">
            <span>By @CryptoSuiAlpha</span>
            <span className="text-[var(--win)] font-semibold">+8 Credibility</span>
          </div>
        </div>

        {/* Worst Pick */}
        <div className="p-3.5 rounded-[10px] bg-[var(--loss-bg)] border border-[var(--loss)]/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-bold text-[var(--loss)] uppercase text-[10px]">
              <TrendingDown className="w-3.5 h-3.5" />
              Maximum Drawdown
            </span>
            <span className="font-bold text-[var(--loss)]">-$300 PnL</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)]">Arsenal vs Liverpool Under 2.5</h4>
            <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
              Set-piece defensive collapses produced 4 goals (2-2 draw).
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1 flex justify-between border-t border-[var(--loss)]/15">
            <span>By @EPLFootyPicks</span>
            <span className="text-[var(--loss)] font-semibold">-5 Credibility</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Asymmetry Index: 1.93x</span>
        <span>Memory Audit: Permanent</span>
      </div>
    </BentoCard>
  );
}
