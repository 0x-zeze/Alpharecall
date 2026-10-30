"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { Clock, ArrowRight } from "lucide-react";
import { PredictionRecord } from "@/lib/types";

interface OpenPredictionsCardProps {
  predictions: PredictionRecord[];
  onViewAll?: () => void;
}

export function OpenPredictionsCard({
  predictions,
  onViewAll,
}: OpenPredictionsCardProps) {
  const pendingPicks = predictions.filter((p) => p.outcome === "PENDING").slice(0, 4);

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.3} className="flex flex-col justify-between">
      <div>
        <BentoHeader
          title="Active Open Predictions"
          subtitle="Real-time fixtures & breakout levels pending resolution"
          action={
            onViewAll && (
              <button
                onClick={onViewAll}
                className="flex items-center gap-1 text-[11px] font-mono-num text-[var(--accent)] hover:underline"
              >
                <span>Full Ledger</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )
          }
        />

        <div className="space-y-2.5 my-2">
          {pendingPicks.length === 0 ? (
            <div className="text-xs text-[var(--muted)] py-6 text-center font-mono-num">
              No active pending predictions.
            </div>
          ) : (
            pendingPicks.map((pick) => (
              <div
                key={pick.id}
                className="p-3 rounded-[10px] bg-[var(--border-subtle)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)] truncate block">
                      {pick.target}
                    </span>
                    <span className="text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]">
                      {pick.odds}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">{pick.pick}</p>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono-num font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Clock className="w-3 h-3" />
                  <span>Pending</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Total Open: {pendingPicks.length} Calls</span>
        <span>Resolution Trigger: Tatum Sui / Sports Oracle</span>
      </div>
    </BentoCard>
  );
}
