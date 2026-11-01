"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Shield, Sparkles, AlertCircle } from "lucide-react";
import { PredictionCategory } from "@/lib/types";

interface AddPredictionSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
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
}

export function AddPredictionSlideOver({
  isOpen,
  onClose,
  onSubmit,
}: AddPredictionSlideOverProps) {
  const [target, setTarget] = useState("");
  const [pick, setPick] = useState("");
  const [sportType, setSportType] = useState<PredictionCategory>("crypto");
  const [odds, setOdds] = useState("-110");
  const [stake, setStake] = useState<number>(250);
  const [analyst, setAnalyst] = useState("@WalrusSharp");
  const [confidence, setConfidence] = useState<number>(4);
  const [reasoning, setReasoning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Crypto Forecast Specific Fields (Bagian 2)
  const [deadline, setDeadline] = useState(() =>
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [targetPriceInput, setTargetPriceInput] = useState("2.0");
  const [asset, setAsset] = useState("SUI");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalTarget = target.trim();
    let finalPick = pick.trim();
    let parsedTargetPrice: number | undefined = undefined;

    if (sportType === "crypto") {
      if (!deadline) {
        setFormError("Crypto forecasts require a settlement deadline.");
        return;
      }

      if (!targetPriceInput.trim()) {
        setFormError("Target price is required.");
        return;
      }

      const normalizedPriceStr = targetPriceInput.trim().replace(",", ".");
      parsedTargetPrice = parseFloat(normalizedPriceStr);

      if (isNaN(parsedTargetPrice) || parsedTargetPrice <= 0) {
        setFormError("Target price must be a valid number greater than 0.");
        return;
      }

      // Automatically generate target and pick text from structured fields to prevent contradictions
      finalTarget = `${asset}/USD`;
      finalPick = `${asset} ${direction === "above" ? ">" : "<"} $${normalizedPriceStr}`;
    } else {
      if (!finalTarget || !finalPick) {
        setFormError("Target and Pick are required.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const deadlineIso = sportType === "crypto" && deadline ? new Date(deadline).toISOString() : undefined;
      const res = await onSubmit({
        target: finalTarget,
        pick: finalPick,
        sportType,
        odds: odds.trim(),
        stake,
        analyst: analyst.trim(),
        confidence,
        reasoning: reasoning.trim(),
        deadline: deadlineIso,
        direction: sportType === "crypto" ? direction : undefined,
        targetPrice: sportType === "crypto" ? parsedTargetPrice : undefined,
        asset: sportType === "crypto" ? asset : undefined,
      });

      if (res && !res.success && res.error) {
        setFormError(res.error);
        return;
      }

      // Reset form
      setTarget("");
      setPick("");
      setTargetPriceInput("2.0");
      setReasoning("");
      setFormError(null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record prediction";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col p-6 overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-5">
              <div>
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--accent)]" />
                  Commit New Forecast
                </h3>
                <p className="text-xs text-[var(--muted)] font-mono-num mt-0.5">
                  Direct cryptographic write to Walrus Memory
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] bg-[var(--border-subtle)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center transition"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono-num flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 space-y-4 text-xs font-mono-num">
              {/* Sector / Category */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Sector Category
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["crypto", "soccer", "nba"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSportType(cat);
                        setFormError(null);
                      }}
                      className={`py-2 px-2 rounded-[8px] border text-center font-medium capitalize transition ${
                        sportType === cat
                          ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] font-semibold"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crypto Specific Forecast Settings */}
              {sportType === "crypto" && (
                <div className="p-3.5 rounded-[10px] bg-[var(--bg)] border border-[var(--accent)]/30 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[var(--accent)] font-semibold">
                    <span>Forecast Settlement Parameters</span>
                    <span className="text-[10px] text-[var(--muted)]">Tatum Data Oracle</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">Asset</label>
                      <select
                        value={asset}
                        onChange={(e) => setAsset(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)]"
                      >
                        <option value="SUI">SUI</option>
                        <option value="BTC">BTC</option>
                        <option value="ETH">ETH</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">Direction</label>
                      <select
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as "above" | "below")}
                        className="w-full px-2 py-1.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)]"
                      >
                        <option value="above">Above (&gt;=)</option>
                        <option value="below">Below (&lt;=)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">Target Price ($)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="e.g. 1.85 or 0,9"
                        value={targetPriceInput}
                        onChange={(e) => setTargetPriceInput(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-xs font-mono-num"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">
                      Settlement Deadline (Required)
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-[11px]"
                    />
                    <span className="text-[10px] text-[var(--muted)] block mt-1">
                      Must be strictly in the future (within 30 days). Evaluated via Tatum at deadline.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num space-y-0.5">
                    <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Auto-Generated Target & Pick</div>
                    <div className="text-[var(--text)] text-[11px]">
                      Target: <span className="font-semibold text-[var(--text)]">{asset}/USD</span>
                    </div>
                    <div className="text-[var(--accent)] font-semibold text-[11px]">
                      Pick: {asset} {direction === "above" ? ">" : "<"} ${targetPriceInput.trim().replace(",", ".") || "..."}
                    </div>
                  </div>
                </div>
              )}

              {/* Target & Pick (Manual entry for Soccer / NBA) */}
              {sportType !== "crypto" && (
                <>
                  <div>
                    <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                      Target Fixture or Event
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UCL Real Madrid vs AC Milan"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                      Specific Forecast / Pick
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. RMA Win & Over 2.5"
                      value={pick}
                      onChange={(e) => setPick(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Odds & Stake */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Implied Odds
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="-110 or +145"
                    value={odds}
                    onChange={(e) => setOdds(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Stake Amount ($)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    required
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Forecaster & Confidence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Forecaster Handle (@handle)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^@[A-Za-z0-9_]{3,30}$"
                    title="Handle must begin with @ followed by 3-30 letters, numbers, or underscores"
                    value={analyst}
                    onChange={(e) => setAnalyst(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Confidence (1-5)
                  </label>
                  <select
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {"★".repeat(lvl)} ({lvl}/5)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Analytical Thesis / Reasoning
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain the tactical or onchain rationale behind this call..."
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none resize-none"
                />
              </div>

              {/* Info Pill */}
              <div className="p-3 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)] text-[11px] text-[var(--muted)] flex items-start gap-2">
                <Shield className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>
                  Outcome is strictly locked to PENDING. Verified settlement will occur automatically at deadline via Tatum Data API.
                </span>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 mt-auto">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--accent)] hover:opacity-90 text-[#0a0a0b] font-bold text-xs font-mono-num flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Writing to Walrus Mainnet..." : "Commit Memory to Walrus"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
