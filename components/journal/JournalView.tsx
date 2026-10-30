"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Star,
  RefreshCw,
} from "lucide-react";
import { PredictionRecord, PredictionCategory, PredictionStatus } from "@/lib/types";
import { AddPredictionSlideOver } from "./AddPredictionSlideOver";
import { getWalrusBlobExplorerUrl } from "@/lib/explorer";

interface JournalViewProps {
  predictions: PredictionRecord[];
  onAddPrediction: (data: {
    target: string;
    pick: string;
    sportType: PredictionCategory;
    odds: string;
    stake: number;
    analyst: string;
    confidence: number;
    reasoning: string;
  }) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}

export function JournalView({ predictions, onAddPrediction, onRefresh }: JournalViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | PredictionCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PredictionStatus>("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveFeedback, setResolveFeedback] = useState<string | null>(null);

  const handleCheckResultsNow = async () => {
    setIsResolving(true);
    setResolveFeedback(null);
    try {
      const res = await fetch("/api/resolve", { method: "POST" });
      const data = await res.json();
      if (data?.success) {
        setResolveFeedback(
          `Evaluated ${data.totalEvaluated}: ${data.resolvedCount} resolved, ${data.skippedCount} already settled.`
        );
        if (onRefresh) await onRefresh();
      } else {
        setResolveFeedback(`Resolution error: ${data?.error || "Unknown"}`);
      }
    } catch (err: unknown) {
      setResolveFeedback(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsResolving(false);
      setTimeout(() => setResolveFeedback(null), 6000);
    }
  };

  // Filtered dataset
  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchesSearch =
        p.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pick.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.analyst.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === "all" || p.sportType === categoryFilter;
      const matchesStatus = statusFilter === "all" || p.outcome === statusFilter;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [predictions, searchQuery, categoryFilter, statusFilter]);

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)]">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search fixture, asset, pick, or forecaster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono-num text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Filters & CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | PredictionCategory)}
            className="px-2.5 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono-num text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Sectors</option>
            <option value="soccer">Soccer (UCL/EPL)</option>
            <option value="nba">NBA</option>
            <option value="crypto">Crypto (Sui/BTC)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | PredictionStatus)}
            className="px-2.5 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono-num text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Outcomes</option>
            <option value="ACCURATE">Accurate (Wins)</option>
            <option value="FAILED">Failed (Losses)</option>
            <option value="PENDING">Pending (Open)</option>
          </select>

          {/* Check Results Now CTA */}
          <button
            onClick={handleCheckResultsNow}
            disabled={isResolving}
            className="flex items-center gap-1.5 py-2 px-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] font-mono-num font-semibold text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResolving ? "animate-spin text-[var(--accent)]" : ""}`} />
            <span>{isResolving ? "Resolving..." : "Check results now"}</span>
          </button>

          {/* Log New Prediction CTA */}
          <button
            onClick={() => setIsSlideOverOpen(true)}
            className="flex items-center gap-2 py-2 px-3.5 rounded-[8px] bg-[var(--accent)] text-[#0a0a0b] font-mono-num font-bold text-xs hover:opacity-90 transition shrink-0 ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Prediction</span>
          </button>
        </div>

        {resolveFeedback && (
          <div className="mt-3 p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--accent)]/30 text-xs font-mono-num text-[var(--accent)] flex items-center justify-between">
            <span>{resolveFeedback}</span>
            <button onClick={() => setResolveFeedback(null)} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-num border-collapse">
            <thead className="bg-[var(--border-subtle)] text-[var(--muted)] uppercase border-b border-[var(--border)] text-[10px] select-none">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Sector</th>
                <th className="py-3 px-4">Market / Event</th>
                <th className="py-3 px-4">Pick</th>
                <th className="py-3 px-4 text-center">Odds</th>
                <th className="py-3 px-4 text-right">Stake</th>
                <th className="py-3 px-4 text-center">Outcome</th>
                <th className="py-3 px-4 text-right">PnL</th>
                <th className="py-3 px-4">Forecaster</th>
                <th className="py-3 px-4 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--muted)] text-xs">
                    No matching predictions found.
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((pred) => {
                  const isExpanded = expandedRowId === pred.id;
                  return (
                    <React.Fragment key={pred.id}>
                      <tr
                        onClick={() => toggleRow(pred.id)}
                        className={`cursor-pointer transition-colors hover:bg-[var(--border-subtle)]/60 ${
                          isExpanded ? "bg-[var(--border-subtle)]/40" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-[var(--muted)] whitespace-nowrap">
                          {pred.dateStr || "Today"}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[10px] uppercase font-semibold">
                            {pred.sportType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[var(--text)] whitespace-nowrap">
                          {pred.target}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text)] whitespace-nowrap font-medium">
                          {pred.pick}
                        </td>
                        <td className="py-3.5 px-4 text-center text-[var(--muted)] whitespace-nowrap">
                          {pred.odds}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium">
                          ${pred.stake}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {pred.outcome === "ACCURATE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Hit
                            </span>
                          )}
                          {pred.outcome === "FAILED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--loss-bg)] text-[var(--loss)] border border-[var(--loss)]/20">
                              <XCircle className="w-3 h-3" />
                              Miss
                            </span>
                          )}
                          {pred.outcome === "PENDING" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--pending-bg)] text-[var(--pending)] border border-[var(--pending)]/20">
                              <Clock className="w-3 h-3" />
                              Open
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold">
                          {pred.pnl > 0 ? (
                            <span className="text-[var(--win)]">+${pred.pnl}</span>
                          ) : pred.pnl < 0 ? (
                            <span className="text-[var(--loss)]">-${Math.abs(pred.pnl)}</span>
                          ) : (
                            <span className="text-[var(--muted)]">$0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-[var(--accent)] font-medium">
                          {pred.analyst}
                        </td>
                        <td className="py-3.5 px-4 text-center text-[var(--muted)]">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 mx-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 mx-auto" />
                          )}
                        </td>
                      </tr>

                      {/* Inline Expanded Detail Drawer with AnimatePresence */}
                      {isExpanded && (
                        <tr className="bg-[var(--border-subtle)]/30">
                          <td colSpan={10} className="p-0">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="p-5 border-y border-[var(--border)] space-y-3"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Reasoning */}
                                <div className="space-y-1 md:col-span-2">
                                  <span className="text-[10px] uppercase text-[var(--muted)] block">
                                    Analytical Reasoning & Thesis
                                  </span>
                                  <p className="text-xs text-[var(--text)] leading-relaxed">
                                    {pred.reasoning || pred.content}
                                  </p>
                                  {pred.postMortem && (
                                    <div className="pt-2">
                                      <span className="text-[10px] uppercase text-[var(--muted)] block">
                                        Post-Mortem Resolution Audit
                                      </span>
                                      <p className="text-xs text-[var(--text)]/80 italic">
                                        {pred.postMortem}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Metadata & Walrus Hash */}
                                <div className="space-y-2.5 p-3.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[var(--muted)] text-[11px]">Confidence</span>
                                    <div className="flex items-center gap-0.5 text-amber-400">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`w-3 h-3 ${
                                            i < (pred.confidence || 4)
                                              ? "fill-amber-400 text-amber-400"
                                              : "text-[var(--border)]"
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-[var(--muted)] text-[11px]">Credibility Delta</span>
                                    <span
                                      className={`font-bold ${
                                        pred.credibilityDelta > 0
                                          ? "text-[var(--win)]"
                                          : pred.credibilityDelta < 0
                                          ? "text-[var(--loss)]"
                                          : "text-[var(--muted)]"
                                      }`}
                                    >
                                      {pred.credibilityDelta > 0
                                        ? `+${pred.credibilityDelta}`
                                        : pred.credibilityDelta}
                                    </span>
                                  </div>

                                  {/* Settlement Type & Oracle Classification */}
                                  {pred.outcome === "PENDING" && (
                                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                                      <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Oracle Pipeline</span>
                                      {pred.sportType === "crypto" ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                                          Tatum Data API / Price Oracle
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30">
                                          Manual Resolution (Sports Feed)
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Honest On-Chain State / Walrus Verification Link */}
                                  {pred.writeStatus === "confirmed" && pred.blobId ? (
                                    <div className="pt-2 border-t border-[var(--border)]">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">
                                          Walrus Mainnet Blob
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/30">
                                          Confirmed
                                        </span>
                                      </div>
                                      <a
                                        href={getWalrusBlobExplorerUrl(pred.blobId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 font-mono-num text-[11px] text-[var(--accent)] hover:underline break-all"
                                      >
                                        <span>{pred.blobId}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    </div>
                                  ) : pred.writeStatus === "failed" ? (
                                    <div className="pt-2 border-t border-[var(--border)]">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-[var(--loss)] uppercase font-semibold">
                                          Walrus Write Failed
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-[var(--loss)] font-mono-num break-all">
                                        {pred.writeError || "Relayer write rejected"}
                                      </p>
                                    </div>
                                  ) : pred.writeStatus === "pending" ? (
                                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                                      <span className="text-[10px] text-[var(--muted)] uppercase">On-Chain State</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30">
                                        Writing to Walrus...
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                                      <span className="text-[10px] text-[var(--muted)] uppercase">On-Chain State</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--muted)] bg-[var(--border-subtle)] border border-[var(--border)]">
                                        Local Demo (Not on-chain)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Panel */}
      <AddPredictionSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onSubmit={onAddPrediction}
      />
    </div>
  );
}
