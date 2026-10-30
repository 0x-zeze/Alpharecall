"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Shield, Sparkles } from "lucide-react";
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
  }) => Promise<void>;
}

export function AddPredictionSlideOver({
  isOpen,
  onClose,
  onSubmit,
}: AddPredictionSlideOverProps) {
  const [target, setTarget] = useState("");
  const [pick, setPick] = useState("");
  const [sportType, setSportType] = useState<PredictionCategory>("soccer");
  const [odds, setOdds] = useState("-110");
  const [stake, setStake] = useState<number>(250);
  const [analyst, setAnalyst] = useState("@YourHandle");
  const [confidence, setConfidence] = useState<number>(4);
  const [reasoning, setReasoning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !pick) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        target,
        pick,
        sportType,
        odds,
        stake,
        analyst,
        confidence,
        reasoning,
      });
      // Reset form
      setTarget("");
      setPick("");
      setReasoning("");
      onClose();
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
                  Commit New Prediction
                </h3>
                <p className="text-xs text-[var(--muted)] font-mono-num mt-0.5">
                  Direct write to Walrus Memory Mainnet
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 space-y-4 text-xs font-mono-num">
              {/* Sector / Category */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Sector Category
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["soccer", "nba", "crypto"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSportType(cat)}
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

              {/* Target */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Target Fixture or Asset
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UCL Real Madrid vs Milan or SUI/USDT Breakout"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {/* Pick / Call */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Specific Forecast / Pick
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OVER 2.5 Total Goals or LONG > $2.20"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

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
                    min="1"
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
                    Forecaster Handle
                  </label>
                  <input
                    type="text"
                    required
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
                  rows={3}
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
                  This entry will be hashed and signed by your Walrus Agent key on Sui Mainnet.
                </span>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 mt-auto">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[var(--accent)] hover:opacity-90 text-[#0a0a0b] font-bold text-xs font-mono-num flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Writing to Mainnet..." : "Commit Memory to Walrus"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
