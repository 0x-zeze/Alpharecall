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
  Shield,
  Calendar,
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
    deadline?: string;
    direction?: "above" | "below";
    targetPrice?: number;
    asset?: string;
  }) => Promise<{ success: boolean; error?: string } | void>;
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
      if (data?.cooldownActive) {
        setResolveFeedback(data.message);
      } else if (data?.success) {
        const deferredText = data.batchDeferredCount ? ` (${data.batchDeferredCount} deferred by batch cap)` : "";
        setResolveFeedback(
          `Evaluated ${data.totalEvaluated}: ${data.resolvedCount} resolved, ${data.skippedCount} skipped${deferredText}.`
        );
        if (onRefresh) await onRefresh();
      } else {
        setResolveFeedback(`Resolution: ${data?.error || "Request failed"}`);
      }
    } catch (err: unknown) {
      setResolveFeedback(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsResolving(false);
      setTimeout(() => setResolveFeedback(null), 8000);
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
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search fixtures, picks, forecasters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-xs font-mono-num text-[var(--text)] placeholder:text-[var(--muted)]/60 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | PredictionCategory)}
            className="px-2.5 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-xs font-mono-num text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="all">All Sectors</option>
            <option value="crypto">Crypto (Sui/BTC/ETH)</option>
            <option value="soccer">Soccer (UCL/EPL)</option>
            <option value="nba">NBA</option>
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
            <span>{isResolving ? "Checking..." : "Check results now"}</span>
          </button>

          {/* Log New Prediction CTA */}
          <button
            onClick={() => setIsSlideOverOpen(true)}
            className="flex items-center gap-2 py-2 px-3.5 rounded-[8px] bg-[var(--accent)] text-[#0a0a0b] font-mono-num font-bold text-xs hover:opacity-90 transition shrink-0 ml-auto sm:ml-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Forecast</span>
          </button>
        </div>
      </div>

      {resolveFeedback && (
        <div className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--accent)]/30 text-xs font-mono-num text-[var(--accent)] flex items-center justify-between">
          <span>{resolveFeedback}</span>
          <button onClick={() => setResolveFeedback(null)} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
        </div>
      )}

      {/* Mobile cards — table is desktop-only */}
      <div className="md:hidden space-y-3">
        {filteredPredictions.length === 0 ? (
          <div className="bento-card p-8 text-center text-[var(--muted)] text-xs">
            No matching predictions found.
          </div>
        ) : (
          filteredPredictions.map((pred, idx) => {
            const isExpanded = expandedRowId === pred.id;
            const isHistoricalBacktest = pred.id.startsWith("rec-");
            return (
              <button
                key={`${pred.id}-card-${idx}`}
                type="button"
                onClick={() => toggleRow(pred.id)}
                className="bento-card w-full text-left p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[var(--muted)] font-mono-num">{pred.dateStr}</div>
                    <div className="font-semibold text-sm text-[var(--text)] break-words">{pred.target}</div>
                    <div className="text-xs text-[var(--muted)] mt-0.5 break-words">{pred.pick}</div>
                  </div>
                  {pred.outcome === "ACCURATE" ? (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--win-bg)] text-[var(--win)]">ACCURATE</span>
                  ) : pred.outcome === "FAILED" ? (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--loss-bg)] text-[var(--loss)]">FAILED</span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">PENDING</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-num text-[var(--muted)]">
                  <span className="uppercase">{pred.sportType}</span>
                  <span>{isHistoricalBacktest ? "Backtest" : "Live"}</span>
                  <span>Stake ${pred.stake}</span>
                  <span className="text-[9px]">simulated stake</span>
                  <span>{pred.analyst}</span>
                  {pred.outcome !== "PENDING" && (
                    <span className={pred.pnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"}>
                      {pred.pnl >= 0 ? "+" : "-"}${Math.abs(pred.pnl)}
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text)] leading-relaxed space-y-1">
                    <p>{pred.reasoning || pred.content}</p>
                    {pred.deadline && (
                      <p className="text-[var(--muted)]">
                        Deadline {new Date(pred.deadline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    <p className="text-[var(--muted)]">
                      {pred.suiCheckpoint
                        ? `Sui #${pred.suiCheckpoint.slice(-8)}${
                            pred.suiCheckpointSource === "tatum-gateway"
                              ? " via Tatum gateway"
                              : pred.suiCheckpointSource === "sui-graphql"
                              ? " via Sui GraphQL"
                              : ""
                          }`
                        : "not anchored"}
                      {pred.writeStatus === "confirmed" && pred.blobId ? " · Walrus confirmed" : ""}
                    </p>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="bento-card overflow-hidden hidden md:block">
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
                filteredPredictions.map((pred, idx) => {
                  const isExpanded = expandedRowId === pred.id;
                  const isHistoricalBacktest = pred.id.startsWith("rec-");

                  return (
                    <React.Fragment key={`${pred.id}-${pred.writeStatus}-${idx}`}>
                      <tr
                        onClick={() => toggleRow(pred.id)}
                        className={`hover:bg-[var(--border-subtle)]/50 transition cursor-pointer ${
                          isExpanded ? "bg-[var(--border-subtle)]/40" : ""
                        }`}
                      >
                        {/* Date */}
                        <td className="py-3 px-4 text-[var(--muted)] whitespace-nowrap">
                          {pred.dateStr}
                        </td>

                        {/* Sector Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              pred.sportType === "crypto"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : pred.sportType === "soccer"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {pred.sportType}
                          </span>
                        </td>

                        {/* Market / Event */}
                        <td className="py-3 px-4 font-semibold text-[var(--text)] max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{pred.target}</span>
                            {isHistoricalBacktest ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                Backtest
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                Live
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Pick */}
                        <td className="py-3 px-4 font-medium text-[var(--text)] whitespace-nowrap">
                          {pred.pick}
                        </td>

                        {/* Implied Odds */}
                        <td className="py-3 px-4 text-center text-[var(--muted)] whitespace-nowrap">
                          {pred.odds}
                        </td>

                        {/* Stake */}
                        <td className="py-3 px-4 text-right text-[var(--muted)] whitespace-nowrap">
                          ${pred.stake}
                        </td>

                        {/* Outcome Badge */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {pred.outcome === "ACCURATE" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ACCURATE</span>
                            </span>
                          ) : pred.outcome === "FAILED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--loss-bg)] text-[var(--loss)] border border-[var(--loss)]/30">
                              <XCircle className="w-3 h-3" />
                              <span>FAILED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              <span>PENDING</span>
                            </span>
                          )}
                        </td>

                        {/* PnL */}
                        <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                          {pred.outcome === "ACCURATE" ? (
                            <span className="text-[var(--win)]">+${pred.pnl}</span>
                          ) : pred.outcome === "FAILED" ? (
                            <span className="text-[var(--loss)]">-${Math.abs(pred.pnl)}</span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>

                        {/* Forecaster */}
                        <td className="py-3 px-4 text-[var(--muted)] whitespace-nowrap">
                          {pred.analyst}
                        </td>

                        {/* Expand Toggle */}
                        <td className="py-3 px-4 text-center text-[var(--muted)]">
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
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase text-[var(--muted)] block">
                                      Analytical Reasoning & Thesis
                                    </span>
                                    {pred.oracleFallbackUsed && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30">
                                        Resolved via public fallback, not Tatum
                                      </span>
                                    )}
                                  </div>
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

                                {/* Metadata & Verification Details */}
                                <div className="space-y-2 p-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs">
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

                                  {/* Settlement Deadline */}
                                  {pred.deadline && (
                                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                                      <span className="text-[var(--muted)] text-[11px] flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Deadline
                                      </span>
                                      <span className="font-mono-num text-[10px] text-[var(--text)]">
                                        {new Date(pred.deadline).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  )}

                                  {/* Sui Checkpoint Anchor */}
                                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                                    <span className="text-[var(--muted)] text-[11px] flex items-center gap-1">
                                      <Shield className="w-3 h-3" /> Sui Anchor
                                    </span>
                                    {pred.suiCheckpoint ? (
                                      <span className="font-mono-num text-[10px] text-[var(--accent)] font-semibold">
                                        #{pred.suiCheckpoint.slice(-8)}
                                        {pred.suiCheckpointSource === "tatum-gateway" ? (
                                          <span className="text-[var(--muted)] font-normal ml-1">via Tatum gateway</span>
                                        ) : pred.suiCheckpointSource === "sui-graphql" ? (
                                          <span className="text-[var(--muted)] font-normal ml-1">via Sui GraphQL</span>
                                        ) : null}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-[var(--muted)] italic">not anchored</span>
                                    )}
                                  </div>

                                  {/* Oracle Classification */}
                                  {pred.outcome === "PENDING" && (
                                    <div className="pt-1 border-t border-[var(--border)] flex items-center justify-between">
                                      <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Oracle</span>
                                      {pred.sportType === "crypto" ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                                          Tatum Data API
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30">
                                          Manual Resolution
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Honest Walrus Blob Link */}
                                  {pred.writeStatus === "confirmed" && pred.blobId ? (
                                    <div className="pt-1.5 border-t border-[var(--border)]">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">
                                          Walrus Mainnet Blob
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/30">
                                          Confirmed
                                        </span>
                                      </div>
                                      <a
                                        href={getWalrusBlobExplorerUrl(pred.blobId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 font-mono-num text-[11px] text-[var(--accent)] hover:underline break-all"
                                      >
                                        <span className="truncate max-w-[180px]">{pred.blobId}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
                                      Status: {pred.writeStatus}
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

      {/* Add Prediction SlideOver */}
      <AddPredictionSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onSubmit={onAddPrediction}
      />
    </div>
  );
}
