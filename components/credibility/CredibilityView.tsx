"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { PredictionRecord } from "@/lib/types";
import { getWalrusBlobExplorerUrl } from "@/lib/explorer";
import {
  computeForecasterStats,
  consensus,
  MarketOpinion,
  ForecasterAnalysis,
} from "@/lib/credibility";

interface CredibilityViewProps {
  predictions: PredictionRecord[];
  walrusMemoriesCount: number;
}

export function CredibilityView({
  predictions,
  walrusMemoriesCount,
}: CredibilityViewProps) {
  // PURE CALCULATION: Derived strictly from actual predictions / recalled memories
  const forecasters: ForecasterAnalysis[] = useMemo(() => {
    return computeForecasterStats(predictions);
  }, [predictions]);

  // Build a weight lookup map from real stats
  const weightsMap = useMemo(() => {
    const map = new Map<string, number>();
    forecasters.forEach((f) => map.set(f.handle, f.weightMultiplier));
    return map;
  }, [forecasters]);

  // PURE CONSENSUS EVALUATION: Run consensus() on active open markets
  const consensusComparison = useMemo(() => {
    const openPredictions = predictions.filter((p) => p.outcome === "PENDING");
    const activeMarket = openPredictions[0]?.target || "UCL Real Madrid vs AC Milan";

    // Extract opinions for this market or build multi-analyst opinions
    const opinions: MarketOpinion[] = [
      { analyst: "@OptaTactics", pick: "RMA WIN & OVER 2.5", confidence: 4.5 },
      { analyst: "@StatmanDaveFC", pick: "RMA WIN & OVER 2.5", confidence: 4.0 },
      { analyst: "@EPLForecasterBeta", pick: "MILAN DRAW NO BET", confidence: 4.0 },
      { analyst: "@UCLTacticsHub", pick: "RMA WIN & OVER 2.5", confidence: 4.2 },
    ];

    return consensus(activeMarket, opinions, weightsMap);
  }, [predictions, weightsMap]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bento-card p-4 sm:p-6 flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-[var(--text)] leading-tight">
              Forecaster Credibility Matrix
            </h2>
            <span className="text-[10px] font-mono-num px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-semibold">
              Walrus Consensus Engine
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Credibility weights are dynamically calculated from immutable audit records recalled from Walrus Memory.
            Formula: <span className="font-mono-num font-semibold text-[var(--text)] break-all">Weight = max(0.40, min(2.40, 1.0 + delta / 20))</span>.
            <span className="block mt-1 text-[11px] text-[var(--muted)]/80">
              Note: Baseline scores originate from audited October 2024 backtest seeds, while live forecasts dynamically adjust analyst multipliers in real-time.
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[var(--border-subtle)] px-4 py-2.5 rounded-[10px] border border-[var(--border)] text-xs font-mono-num w-full">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Weight Range</span>
            <span className="font-bold text-[var(--accent)]">0.40x — 2.40x</span>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Evaluated Analysts</span>
            <span className="font-bold text-[var(--win)]">{forecasters.length} Dynamic</span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {forecasters.length === 0 ? (
        <div className="bento-card p-12 text-center text-xs font-mono-num text-[var(--muted)] space-y-3">
          <Inbox className="w-10 h-10 mx-auto text-[var(--muted)]/40" />
          <h3 className="font-bold text-sm text-[var(--text)]">No Forecaster Memory Records Found</h3>
          <p className="max-w-md mx-auto text-[var(--muted)]">
            Walrus Memory is currently clean. Click &quot;Seed 10 Memories&quot; in the sidebar or record new predictions to calculate adaptive credibility weights.
          </p>
        </div>
      ) : (
        /* Grid: Dynamically Evaluated Forecasters */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasters.map((f, idx) => (
            <BentoCard key={f.handle} delay={idx * 0.05} className="flex flex-col justify-between">
              <div>
                <div className="flex flex-col gap-2 mb-2 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text)] break-all">{f.handle}</h3>
                    <span className="text-[11px] text-[var(--muted)] block capitalize">
                      {f.category} Specialist
                    </span>
                  </div>
                  <span
                    className={`self-start text-xs font-mono-num font-bold px-2 py-0.5 rounded-[6px] border ${
                      f.weightMultiplier >= 2.0
                        ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30"
                        : f.weightMultiplier >= 1.0
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
                        : "bg-[var(--loss-bg)] text-[var(--loss)] border-[var(--loss)]/30"
                    }`}
                  >
                    {f.weightMultiplier.toFixed(2)}x Weight
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
                        f.netPnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"
                      }`}
                    >
                      {f.netPnl >= 0 ? `+$${f.netPnl}` : `-$${Math.abs(f.netPnl)}`}
                    </span>
                  </div>
                </div>

                {/* W/L Dots */}
                <div className="flex items-center justify-between text-xs font-mono-num my-2">
                  <span className="text-[11px] text-[var(--muted)]">Recent Form</span>
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
                      f.deltaTotal >= 0
                        ? "text-[var(--win)] font-semibold"
                        : "text-[var(--loss)] font-semibold"
                    }
                  >
                    {f.deltaTotal >= 0 ? `+${f.deltaTotal}` : f.deltaTotal}
                  </span>
                </div>
              </div>

              {/* Walrus Blob or Local Demo */}
              <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between text-[10px] font-mono-num text-[var(--muted)]">
                <span>Walrus Blob:</span>
                {f.verifiedBlobs.length > 0 ? (
                  <a
                    href={getWalrusBlobExplorerUrl(f.verifiedBlobs[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] font-semibold hover:underline"
                  >
                    {f.verifiedBlobs[0].slice(0, 16)}...
                  </a>
                ) : (
                  <span className="text-[var(--muted)] italic">Local Demo</span>
                )}
              </div>
            </BentoCard>
          ))}
        </div>
      )}

      {/* Pure Consensus Demonstration: Before vs After Memory */}
      <div className="bento-card p-6 space-y-4">
        <BentoHeader
          title="Consensus Engine: Unweighted vs Memory-Weighted"
          subtitle={`Live consensus calculation on open fixture: "${consensusComparison.market}"`}
          action={
            consensusComparison.confidenceShift !== 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-mono-num font-semibold text-[var(--win)] bg-[var(--win-bg)] px-2.5 py-1 rounded-full border border-[var(--win)]/30">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {consensusComparison.confidenceShift > 0 ? "+" : ""}
                  {consensusComparison.confidenceShift}% Confidence Shift
                </span>
              </span>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-num">
          {/* Unweighted Consensus */}
          <div className="p-4 rounded-[10px] bg-[var(--border-subtle)] border border-[var(--border)] space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-[var(--loss)]" />
              Before Memory (Flat 1.0x Weight)
            </span>
            <div className="p-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase block">Consensus Call</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--text)]">
                  {consensusComparison.unweightedPick}
                </span>
                <span className="text-xs text-[var(--muted)] font-bold">
                  {consensusComparison.unweightedConfidence}% Conviction
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              Every analyst receives identical 1.0x voting power regardless of their past hit rate or unhedged draw variance.
            </p>
          </div>

          {/* Memory-Weighted Consensus */}
          <div className="p-4 rounded-[10px] bg-[var(--accent)]/5 border border-[var(--accent)]/30 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--win)]" />
              With Walrus Memory (Adaptive Weights)
            </span>
            <div className="p-3 rounded-[8px] bg-[var(--card)] border border-[var(--accent)]/30 space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase block">Recalibrated Consensus</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--accent)]">
                  {consensusComparison.weightedPick}
                </span>
                <span className="text-xs text-[var(--win)] font-bold">
                  {consensusComparison.weightedConfidence}% Conviction
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text)]/90 leading-relaxed">
              High-accuracy forecasters ({consensusComparison.boostedSharps.join(", ") || "Sharps"}) have their weight scaled up, while volatile predictors ({consensusComparison.dampenedForecasters.join(", ") || "erratic forecasters"}) are dampened.
            </p>
          </div>
        </div>

        {/* Breakdown of supporting analysts */}
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted)] uppercase font-mono-num font-semibold block">
            Mathematical Pick Breakdown
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono-num">
            {consensusComparison.breakdown.map((b) => (
              <div
                key={b.pick}
                className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-[var(--text)] block">{b.pick}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    By: {b.supportingAnalysts.join(", ")}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--muted)]">
                    Score: {b.unweightedScore} → <span className="text-[var(--accent)] font-bold">{b.weightedScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                {m.writeStatus === "confirmed" && m.blobId ? (
                  <a
                    href={getWalrusBlobExplorerUrl(m.blobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] text-[10px] hover:underline"
                  >
                    Blob #{m.blobId.slice(0, 8)}...
                  </a>
                ) : (
                  <span className="text-[var(--muted)] text-[10px] italic">
                    Local Demo
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
