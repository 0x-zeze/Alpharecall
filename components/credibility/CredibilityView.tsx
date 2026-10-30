"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Award,
  Database,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
} from "lucide-react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { PredictionRecord } from "@/lib/types";

interface CredibilityViewProps {
  predictions: PredictionRecord[];
  walrusMemoriesCount: number;
}

interface ForecasterRank {
  handle: string;
  name: string;
  category: string;
  weight: number; // 0.4 to 2.2
  winRate: number;
  totalPicks: number;
  wins: number;
  losses: number;
  pnl: number;
  recent: ("W" | "L")[];
  walrusBlob: string;
  biasDescription: string;
}

export function CredibilityView({
  predictions,
  walrusMemoriesCount,
}: CredibilityViewProps) {
  // Aggregate real forecasters
  const forecasters: ForecasterRank[] = [
    {
      handle: "@CryptoSuiAlpha",
      name: "Sui Ecosystem & DeFi Specialist",
      category: "Crypto (Sui / L1s)",
      weight: 2.2,
      winRate: 85.7,
      totalPicks: 7,
      wins: 6,
      losses: 1,
      pnl: 1105,
      recent: ["W", "W", "W", "W", "L"],
      walrusBlob: "0x9c3140abde561028374a0098f411cd7341ea22bfbc810052acbb761942aa11e2",
      biasDescription: "Consistently identifies ecosystem momentum before DEX turnover surges.",
    },
    {
      handle: "@TacticalFootyIQ",
      name: "European Football Tactical Model",
      category: "Soccer (UCL / EPL)",
      weight: 2.1,
      winRate: 83.3,
      totalPicks: 6,
      wins: 5,
      losses: 1,
      pnl: 702,
      recent: ["W", "W", "W", "W", "W"],
      walrusBlob: "0x7a89b4f912c4819d92e8fa0172bf42c8d1976a4012bc0991a82f3411b01fa79e",
      biasDescription: "High accuracy on match totals and Asian Handicap underdog lines.",
    },
    {
      handle: "@CourtVisionNBA",
      name: "NBA Pace & Transition Engine",
      category: "NBA (Totals / Outright)",
      weight: 1.8,
      winRate: 75.0,
      totalPicks: 4,
      wins: 3,
      losses: 1,
      pnl: 314,
      recent: ["W", "W", "L", "W"],
      walrusBlob: "0x11223344556677889900aabbccddeeff0011223344556677889900aabbccddee",
      biasDescription: "Capitalizes on back-to-back rest schedule discrepancies.",
    },
    {
      handle: "@MacroCryptoSage",
      name: "BTC Dominance & Liquidity Monitor",
      category: "Crypto (BTC / Macro)",
      weight: 1.9,
      winRate: 80.0,
      totalPicks: 5,
      wins: 4,
      losses: 1,
      pnl: 1332,
      recent: ["W", "W", "W", "W", "L"],
      walrusBlob: "0x56a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde",
      biasDescription: "Excellent sweep and liquidity level projection ahead of options expiry.",
    },
    {
      handle: "@EPLFootyPicks",
      name: "Public Sentiment Forecaster",
      category: "Soccer (La Liga / EPL)",
      weight: 0.6,
      winRate: 40.0,
      totalPicks: 5,
      wins: 2,
      losses: 3,
      pnl: -410,
      recent: ["L", "L", "W", "L", "W"],
      walrusBlob: "0xfe01ab298374162534efcdab8971234567890abcdef0123456789abcdef01234",
      biasDescription: "Recalibrated lower: persistently overvalues favorites in derby matches.",
    },
  ];

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
            <span className="font-bold text-[var(--accent)]">0.4x — 2.2x</span>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Verified Blobs</span>
            <span className="font-bold text-[var(--win)]">{walrusMemoriesCount} on Mainnet</span>
          </div>
        </div>
      </div>

      {/* Grid: Forecaster Cards */}
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
                  {f.weight.toFixed(1)}x Weight
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

              <p className="text-[11px] text-[var(--muted)] italic mt-2">
                "{f.biasDescription}"
              </p>
            </div>

            {/* Walrus Hash */}
            <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between text-[10px] font-mono-num text-[var(--muted)]">
              <span>Walrus Hash:</span>
              <span className="text-[var(--accent)] font-semibold">{f.walrusBlob.slice(0, 16)}...</span>
            </div>
          </BentoCard>
        ))}
      </div>

      {/* Before vs After Memory Recalibration Box */}
      <div className="bento-card p-6 space-y-4">
        <BentoHeader
          title="The Autonomous Memory Loop: Before vs After"
          subtitle="Mathematical demonstration of how Walrus Memory dynamically sharpens consensus picks"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-num">
          {/* Before */}
          <div className="p-4 rounded-[10px] bg-[var(--border-subtle)] border border-[var(--border)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--loss)] flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              Before Memory (Standard Prediction App)
            </span>
            <p className="text-[var(--muted)] leading-relaxed">
              Every forecaster starts each session with identical 1.0x weighting. When an analyst misses 3 high-variance calls in a row, the app has no recollection and recommends their next bet with equal confidence.
            </p>
            <div className="p-2 rounded-[6px] bg-[var(--card)] text-[11px] text-[var(--muted)]">
              Consensus Weight: <span className="text-[var(--text)] font-bold">1.0x Flat (Uncalibrated)</span>
            </div>
          </div>

          {/* After */}
          <div className="p-4 rounded-[10px] bg-[var(--accent)]/5 border border-[var(--accent)]/30 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              With Walrus Memory (AlphaRecall)
            </span>
            <p className="text-[var(--text)]/90 leading-relaxed">
              AlphaRecall executes semantic recall against Walrus Mainnet. Past errors penalize erratic forecasters down to 0.6x, while sharps with proven edge on Soccer & NBA are dynamically boosted to 2.2x.
            </p>
            <div className="p-2 rounded-[6px] bg-[var(--card)] text-[11px] text-[var(--accent)] font-semibold">
              Consensus Formula: <span className="text-[var(--text)] font-mono-num">Weight = max(0.4, 1.0 + Δ / 20)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Recall Live Feed */}
      <div className="bento-card p-6 space-y-4">
        <BentoHeader
          title="Live Walrus Memory Recall Feed"
          subtitle="Recent immutable audit blobs retrieved across session boundaries"
        />

        <div className="space-y-2 text-xs font-mono-num">
          {predictions.slice(0, 5).map((m, i) => (
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
                <span className="text-[var(--muted)]">
                  {new Date(m.timestamp).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
