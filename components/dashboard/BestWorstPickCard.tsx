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
  if (!bestPick && !worstPick) {
    return (
      <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.35}>
        <BentoHeader title="Best and worst resolved pick" subtitle="No resolved records yet." />
      </BentoCard>
    );
  }

  const bestTitle = bestPick?.target || bestPick?.title || "—";
  const bestPnl = bestPick?.pnl ?? 0;
  const bestAnalyst = bestPick?.analyst || "—";
  const bestContent = bestPick?.content || "";
  const bestDelta = bestPick?.credibilityDelta ?? 0;

  const worstTitle = worstPick?.target || worstPick?.title || "—";
  const worstPnl = worstPick?.pnl ?? 0;
  const worstAnalyst = worstPick?.analyst || "—";
  const worstContent = worstPick?.content || "";
  const worstDelta = worstPick?.credibilityDelta ?? 0;

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.35} className="flex flex-col justify-between">
      <BentoHeader
        title="Best and worst resolved pick"
        subtitle="Highest and lowest simulated PnL among resolved records"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
        {/* Best Pick */}
        <div className="p-3.5 rounded-[10px] bg-[var(--win-bg)] border border-[var(--win)]/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-bold text-[var(--win)] uppercase text-[10px]">
              <TrendingUp className="w-3.5 h-3.5" />
              Highest Gain
            </span>
            <span className="font-bold text-[var(--win)]">+{bestPnl >= 0 ? `$${bestPnl}` : `-$${Math.abs(bestPnl)}`} PnL</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)]">{bestTitle}</h4>
            <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
              {bestContent}
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1 flex justify-between border-t border-[var(--win)]/15">
            <span>By {bestAnalyst}</span>
            <span className="text-[var(--win)] font-semibold">+{bestDelta} Credibility</span>
          </div>
        </div>

        {/* Worst Pick */}
        <div className="p-3.5 rounded-[10px] bg-[var(--loss-bg)] border border-[var(--loss)]/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-bold text-[var(--loss)] uppercase text-[10px]">
              <TrendingDown className="w-3.5 h-3.5" />
              Maximum Drawdown
            </span>
            <span className="font-bold text-[var(--loss)]">-${Math.abs(worstPnl)} PnL</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)]">{worstTitle}</h4>
            <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
              {worstContent}
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1 flex justify-between border-t border-[var(--loss)]/15">
            <span>By {worstAnalyst}</span>
            <span className="text-[var(--loss)] font-semibold">{worstDelta} Credibility</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Simulated PnL, not cash</span>
        <span>{bestPick && worstPick ? "From current records" : "Partial sample"}</span>
      </div>
    </BentoCard>
  );
}
