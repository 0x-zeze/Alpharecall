"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ArrowUpRight } from "lucide-react";
import { SIMULATED_STARTING_BANKROLL } from "@/lib/dashboard-stats";

interface BankrollCardProps {
  balance: number;
  startingBalance?: number;
  monthlyPnlPercent: number;
  activeRisk: number;
  avgStakePercent: number;
}

export function BankrollCard({
  balance = SIMULATED_STARTING_BANKROLL,
  monthlyPnlPercent = 0,
  activeRisk = 0,
  avgStakePercent = 0,
}: Partial<BankrollCardProps>) {
  const positive = monthlyPnlPercent >= 0;
  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.25} className="flex flex-col justify-between">
      <BentoHeader
        title="Bankroll Overview"
        subtitle="Simulated bankroll from resolved PnL"
        action={
          <span className="text-[11px] font-mono-num font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            Simulated
          </span>
        }
      />

      <div className="my-2 space-y-1">
        <span className="text-xs uppercase font-mono-num text-[var(--muted)]">Simulated bankroll</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono-num text-[var(--text)] tracking-tight">
            <AnimatedNumber value={balance} prefix="$" />
          </span>
          <span className={`inline-flex items-center text-xs font-mono-num font-semibold ${positive ? "text-[var(--win)]" : "text-[var(--loss)]"}`}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            {positive ? "+" : ""}{monthlyPnlPercent}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-3 border-t border-[var(--border)] text-xs font-mono-num">
        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase block">Active exposure</span>
          <span className="font-semibold text-[var(--text)]">${activeRisk.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase block">Avg stake of bankroll</span>
          <span className="font-semibold text-[var(--accent)]">{avgStakePercent}%</span>
        </div>
      </div>
    </BentoCard>
  );
}
