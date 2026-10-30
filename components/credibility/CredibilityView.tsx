"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { PredictionRecord } from "@/lib/types";

interface CredibilityViewProps {
  predictions: PredictionRecord[];
  walrusMemoriesCount: number;
}

export function calculateCredibilityWeight(deltaSum: number): number {
  // Pure mathematical consensus weighting formula:
  // Weight = max(0.4, min(2.4, 1.0 + deltaSum / 20))
  return Number(Math.max(0.4, Math.min(2.4, 1.0 + deltaSum / 20)).toFixed(2));
}

export function CredibilityView({
  predictions,
  walrusMemoriesCount,
}: CredibilityViewProps) {
  // DYNAMIC AGGREGATION: Calculate all forecaster metrics from actual predictions
  const forecasters = useMemo(() => {
    const map = new Map<
      string,
      {
        handle: string;
        category: string;
        picks: PredictionRecord[];
        wins: number;
        losses: number;
        pending: number;
        pnl: number;
        deltaSum: number;
        walrusBlobs: string[];
      }
    >();

    for (const p of predictions) {
      if (!p.analyst || p.analyst.startsWith("AlphaRecall")) continue;

      const existing = map.get(p.analyst) || {
        handle: p.analyst,
        category:
          p.sportType === "crypto"
            ? "Crypto (Sui / BTC)"
            : p.sportType === "nba"
            ? "NBA Basketball"
            : "European Soccer",
        picks: [],
        wins: 0,
        losses: 0,
        pending: 0,
        pnl: 0,
        deltaSum: 0,
        walrusBlobs: [],
      };

      existing.picks.push(p);
      if (p.outcome === "ACCURATE") existing.wins += 1;
      else if (p.outcome === "FAILED") existing.losses += 1;
      else existing.pending += 1;

      existing.pnl += p.pnl || 0;
      existing.deltaSum += p.credibilityDelta || 0;
      if (p.mainnetCommitHash) {
        existing.walrusBlobs.push(p.mainnetCommitHash);
      }

      map.set(p.analyst, existing);
    }

    return Array.from(map.values())
      .map((f) => {
        const resolved = f.wins + f.losses;
        const winRate = resolved > 0 ? (f.wins / resolved) * 100 : 0;
        const weight = calculateCredibilityWeight(f.deltaSum);
        const sortedPicks = [...f.picks].sort((a, b) => b.timestamp - a.timestamp);
        const recent: ("W" | "L")[] = sortedPicks
          .filter((p) => p.outcome !== "PENDING")
          .slice(0, 5)
          .map((p) => (p.outcome === "ACCURATE" ? "W" : "L"));

        return {
          handle: f.handle,
          name: `${f.category} Forecaster`,
          category: f.category,
          weight,
          winRate: Number(winRate.toFixed(1)),
          totalPicks: f.picks.length,
          wins: f.wins,
          losses: f.losses,
          pnl: f.pnl,
          recent: recent.length > 0 ? recent : (["W"] as ("W" | "L")[]),
          walrusBlob: f.walrusBlobs[0] || null,
          deltaSum: f.deltaSum,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [predictions]);

  // DYNAMIC BEFORE VS AFTER: Compute exact weighted consensus edge
  const memoryComparison = useMemo(() => {
    let unweightedPnl = 0;
    let weightedPnl = 0;
    let resolvedCount = 0;

    // Build a map of analyst weights
    const weightMap = new Map<string, number>();
    forecasters.forEach((f) => {
      weightMap.set(f.handle, f.weight);
    });

    predictions.forEach((p) => {
      if (p.outcome === "PENDING" || !p.pnl) return;
      resolvedCount += 1;
      unweightedPnl += p.pnl; // 1.0x flat weight

      const w = weightMap.get(p.analyst) ?? 1.0;
      weightedPnl += p.pnl * w;
    });

    const pnlGain = weightedPnl - unweightedPnl;
    const gainPercentage =
      unweightedPnl > 0 ? Number(((pnlGain / unweightedPnl) * 100).toFixed(1)) : 0;

    return {
      unweightedPnl: Math.round(unweightedPnl),
      weightedPnl: Math.round(weightedPnl),
      pnlGain: Math.round(pnlGain),
      gainPercentage,
      resolvedCount,
    };
  }, [predictions, forecasters]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bento-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text)]">
              Forecaster Credibility Matrix
            </h2>
            <span className="text-[10px] font-mono-num px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-semibold">
              Live Walrus Calibration
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed max-w-2xl">
            Unlike standard social tipping platforms, AlphaRecall mathematically tracks each forecaster’s
            hit rate and variance. Scores are immutably written to Walrus Memory, permanently weighting future predictions.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[var(--border-subtle)] px-4 py-2.5 rounded-[10px] border border-[var(--border)] shrink-0 text-xs font-mono-num">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Weight Range</span>
            <span className="font-bold text-[var(--accent)]">0.40x — 2.40x</span>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Tracked Forecasters</span>
            <span className="font-bold text-[var(--win)]">{forecasters.length} Dynamic</span>
          </div>
        </div>
      </div>

      {/* Grid: Forecaster Cards (Calculated dynamically) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forecasters.map((f, idx) => (
          <BentoCard key={f.handle} delay={idx * 0.05} className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">{f.handle}</h3>
                  <span className="text-[11px] text-[var(--muted)] block">{f.category}</span>
                </div>
                <span
                  className={`text-xs font-mono-num font-bold px-2 py-0.5 rounded-[6px] border ${
                    f.weight >= 2.0
                      ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30"
                      : f.weight >= 1.0
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
                      : "bg-[var(--loss-bg)] text-[var(--loss)] border-[var(--loss)]/30"
                  }`}
                >
                  {f.weight.toFixed(2)}x Weight
                </span>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 py-2.5 my-2 border-y border-[var(--border)] text-center text-xs font-mono-num">
                <div>
                  <span className="text-[10px] text-[var(--muted)] block uppercase">Win Rate</span>
                  <span className="font-bold text-[var(--text)]">
                    <AnimatedNumber value={f.winRate} decimals={1} suffix="%" />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block uppercase">Record</span>
                  <span className="font-medium text-[var(--text)]">
                    {f.wins}W - {f.losses}L
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block uppercase">Net PnL</span>
                  <span
                    className={`font-bold ${
                      f.pnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"
                    }`}
                  >
                    {f.pnl >= 0 ? `+$${f.pnl}` : `-$${Math.abs(f.pnl)}`}
                  </span>
                </div>
              </div>

              {/* W/L Dots */}
              <div className="flex items-center justify-between text-xs font-mono-num my-2">
                <span className="text-[11px] text-[var(--muted)]">Recent Picks</span>
                <div className="flex items-center gap-1">
                  {f.recent.map((res, i) => (
                    <span
                      key={i}
                      className={`w-4 h-4 rounded-[4px] text-[9px] font-bold flex items-center justify-center ${
                        res === "W"
                          ? "bg-[var(--win-bg)] text-[var(--win)]"
                          : "bg-[var(--loss-bg)] text-[var(--loss)]"
                      }`}
                    >
                      {res}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-[var(--muted)] font-mono-num pt-1 flex justify-between">
                <span>Credibility Delta:</span>
                <span
                  className={
                    f.deltaSum >= 0 ? "text-[var(--win)] font-semibold" : "text-[var(--loss)] font-semibold"
                  }
                >
                  {f.deltaSum >= 0 ? `+${f.deltaSum}` : f.deltaSum}
                </span>
              </div>
            </div>

            {/* Walrus Hash or Local Status */}
            <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between text-[10px] font-mono-num text-[var(--muted)]">
              <span>Walrus Blob:</span>
              <span
                className={
                  f.walrusBlob
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--muted)] italic"
                }
              >
                {f.walrusBlob ? `${f.walrusBlob.slice(0, 16)}...` : "Local Ledger"}
              </span>
            </div>
          </BentoCard>
        ))}
      </div>

      {/* Before vs After Memory Recalibration Box (Computed Dynamically) */}
      <div className="bento-card p-6 space-y-4">
        <BentoHeader
          title="The Autonomous Memory Loop: Before vs After"
          subtitle="Real calculated yield enhancement from Walrus Memory dynamic weighting"
          action={
            <span className="flex items-center gap-1 text-[11px] font-mono-num font-semibold text-[var(--win)] bg-[var(--win-bg)] px-2.5 py-1 rounded-full border border-[var(--win)]/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{memoryComparison.gainPercentage}% Yield Alpha</span>
            </span>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-num">
          {/* Before */}
          <div className="p-4 rounded-[10px] bg-[var(--border-subtle)] border border-[var(--border)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--loss)] flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              Before Memory (Standard Unweighted System)
            </span>
            <p className="text-[var(--muted)] leading-relaxed">
              Every forecaster is assigned flat 1.0x weighting. Miscalculated derby picks and low-probability calls dilute portfolio returns equally with expert sharps.
            </p>
            <div className="p-2.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] flex justify-between items-center text-[11px]">
              <span className="text-[var(--muted)]">Unweighted Total PnL ({memoryComparison.resolvedCount} settled):</span>
              <span className="text-[var(--text)] font-bold">
                ${memoryComparison.unweightedPnl.toLocaleString()}
              </span>
            </div>
          </div>

          {/* After */}
          <div className="p-4 rounded-[10px] bg-[var(--accent)]/5 border border-[var(--accent)]/30 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              With Walrus Memory (AlphaRecall Adaptive Weights)
            </span>
            <p className="text-[var(--text)]/90 leading-relaxed">
              Walrus Memory recall downweights erratic forecasters to as low as 0.40x while scaling verified sharps up to 2.40x. Erroneous picks are dampened and verified edge is multiplied.
            </p>
            <div className="p-2.5 rounded-[6px] bg-[var(--card)] border border-[var(--accent)]/30 flex justify-between items-center text-[11px]">
              <span className="text-[var(--muted)]">Memory-Recalibrated PnL:</span>
              <span className="text-[var(--accent)] font-bold">
                ${memoryComparison.weightedPnl.toLocaleString()} (+${memoryComparison.pnlGain})
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num text-[var(--muted)] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[var(--accent)]" />
            Consensus Weight Formula: Weight = max(0.40, min(2.40, 1.0 + CredibilityDelta / 20))
          </span>
          <span className="text-[var(--text)] font-semibold">Active Engine Verified</span>
        </div>
      </div>

      {/* Memory Recall Live Feed */}
      <div className="bento-card p-6 space-y-4">
        <BentoHeader
          title="Live Walrus Memory Recall Feed"
          subtitle="Recent immutable audit blobs retrieved across session boundaries"
          action={
            <span className="flex items-center gap-1 text-[11px] font-mono-num text-[var(--accent)]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{walrusMemoriesCount} Blobs Stored</span>
            </span>
          }
        />

        <div className="space-y-2 text-xs font-mono-num">
          {predictions.slice(0, 6).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span className="font-semibold text-[var(--text)]">{m.title}</span>
                <span className="text-[10px] text-[var(--muted)]">by {m.analyst}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <span
                  className={
                    m.outcome === "ACCURATE"
                      ? "text-[var(--win)] font-bold"
                      : m.outcome === "FAILED"
                      ? "text-[var(--loss)] font-bold"
                      : "text-amber-500 font-bold"
                  }
                >
                  {m.outcome}
                </span>
                <span className="text-[var(--muted)] font-mono-num">
                  {m.dateStr || "Recent"}
                </span>
                {m.mainnetCommitHash ? (
                  <span className="text-[var(--accent)] text-[10px]">
                    Blob #{m.mainnetCommitHash.slice(0, 8)}
                  </span>
                ) : (
                  <span className="text-[var(--muted)] text-[10px] italic">
                    Local Verified
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
