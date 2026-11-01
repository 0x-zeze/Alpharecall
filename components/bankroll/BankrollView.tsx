"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Wallet, Calculator } from "lucide-react";
import { SIMULATED_STARTING_BANKROLL } from "@/lib/dashboard-stats";

export function BankrollView() {
  const [bankrollTotal] = useState<number>(SIMULATED_STARTING_BANKROLL);
  const [stakeMethod, setStakeMethod] = useState<"flat" | "kelly">("kelly");
  const [winProb, setWinProb] = useState<number>(65); // 65%
  const [decimalOdds, setDecimalOdds] = useState<number>(1.91); // -110 American

  // Kelly formula: (bp - q) / b
  // b = decimalOdds - 1
  // p = winProb / 100
  // q = 1 - p
  const b = Math.max(0.01, decimalOdds - 1);
  const p = winProb / 100;
  const q = 1 - p;
  const fullKellyPercent = Math.max(0, ((b * p - q) / b) * 100);
  const quarterKellyPercent = fullKellyPercent / 4; // Safe institutional fraction

  const recommendedStake =
    stakeMethod === "kelly"
      ? (bankrollTotal * (quarterKellyPercent / 100))
      : (bankrollTotal * 0.025); // 2.5% flat

  const balanceHistory = [
    { date: "sample", balance: SIMULATED_STARTING_BANKROLL },
  ];

  const transactions = [
    { id: "tx-1", type: "profit", desc: "SUI/USDT Breakout Resolution", amount: "+$580", date: "Oct 28", hash: "0x9c31..." },
    { id: "tx-2", type: "profit", desc: "UEFA Champions League RMA vs MIL", amount: "+$200", date: "Oct 29", hash: "0x7a89..." },
    { id: "tx-3", type: "loss", desc: "Premier League Arsenal vs Liverpool", amount: "-$300", date: "Oct 27", hash: "0x44fa..." },
    { id: "tx-4", type: "deposit", desc: "Initial Bankroll Capital", amount: "+$10,000", date: "Oct 01", hash: "Sui Mainnet" },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="liquid-glass p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-[var(--accent-violet)]" />
            <h2 className="text-lg font-heading font-bold text-[var(--text)]">Portfolio & Bankroll Telemetry</h2>
          </div>
          <p className="text-xs text-[var(--muted)] max-w-2xl">
            Stake helper below uses a named simulated starting bankroll. The curve and ledger are a demo sample, not live cash.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[var(--glass-surface-1)] px-4 py-2.5 rounded-xl border border-[var(--border)] font-mono-num text-xs backdrop-blur-sm">
          <span className="text-[11px] font-medium text-amber-400">Simulated</span>
        </div>
      </div>

      {/* Grid: Balance History Chart & Stake Sizing Helper */}
      <div className="grid grid-cols-12 gap-4">
        {/* Balance History Curve */}
        <BentoCard colSpan="col-span-12 lg:col-span-7" delay={0.05}>
          <BentoHeader
            title="Portfolio Balance Trajectory"
            subtitle="Demo sample curve. Not a live balance."
          />

          <div className="mb-2">
            <span className="text-3xl font-bold font-mono-num text-[var(--text)]">
              <AnimatedNumber value={bankrollTotal} prefix="$" />
            </span>
            <span className="text-xs text-[var(--muted)] font-mono-num ml-2">
              starting ${SIMULATED_STARTING_BANKROLL.toLocaleString()} · simulated
            </span>
          </div>

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 500", "dataMax + 500"]}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs font-mono-num shadow-xl">
                          <p className="text-[var(--muted)]">{payload[0].payload.date}</p>
                          <p className="font-bold text-[var(--accent)]">${payload[0].value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#balanceGlow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Stake Sizing Helper (Kelly / Flat %) */}
        <BentoCard colSpan="col-span-12 lg:col-span-5" delay={0.1}>
          <BentoHeader
            title="Simulated Stake Sizing Calculator"
            subtitle="Simulated Kelly Criterion & Flat Risk calculation"
            action={<Calculator className="w-4 h-4 text-[var(--accent)]" />}
          />

          <div className="space-y-3 font-mono-num text-xs">
            {/* Method Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStakeMethod("kelly")}
                className={`py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  stakeMethod === "kelly"
                    ? "bg-[var(--card)] text-[var(--accent)] border border-[var(--border)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Quarter-Kelly (Simulated)
              </button>
              <button
                type="button"
                onClick={() => setStakeMethod("flat")}
                className={`py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  stakeMethod === "flat"
                    ? "bg-[var(--card)] text-[var(--accent)] border border-[var(--border)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Flat 2.5% (Simulated)
              </button>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--muted)] uppercase block mb-1">Win Probability</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={winProb}
                  onChange={(e) => setWinProb(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--muted)] uppercase block mb-1">Decimal Odds</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.05"
                  value={decimalOdds}
                  onChange={(e) => setDecimalOdds(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>

            {/* Recommended Output Box */}
            <div className="p-4 rounded-[10px] bg-[var(--accent)]/10 border border-[var(--accent)]/30 space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase block">Optimal Recommendation (Simulated)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[var(--accent)]">
                  ${Math.round(recommendedStake).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-[var(--text)]">
                  {stakeMethod === "kelly" ? `${quarterKellyPercent.toFixed(1)}% of Simulated Bankroll` : "2.5% of Simulated Bankroll"}
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted)] pt-1">
                {stakeMethod === "kelly"
                  ? "Mathematically balances simulated expected value against drawdown variance."
                  : "Conservative fixed allocation ideal for high-variance streak mitigation."}
              </p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Ledger Table */}
      <BentoCard colSpan="col-span-12" delay={0.15}>
        <BentoHeader
          title="Bankroll Capital Ledger"
          subtitle="Demo sample rows. Not settlement receipts."
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-num border-collapse">
            <thead className="bg-[var(--border-subtle)] text-[var(--muted)] uppercase border-b border-[var(--border)] text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--border-subtle)]/40">
                  <td className="py-3 px-4 text-[var(--muted)]">{tx.date}</td>
                  <td className="py-3 px-4 font-medium">{tx.desc}</td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      tx.type === "profit" || tx.type === "deposit"
                        ? "text-[var(--win)]"
                        : "text-[var(--loss)]"
                    }`}
                  >
                    {tx.amount}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--accent)] font-semibold">{tx.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BentoCard>
    </div>
  );
}
