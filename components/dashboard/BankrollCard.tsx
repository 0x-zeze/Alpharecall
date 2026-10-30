"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

interface BankrollCardProps {
  balance: number; // e.g. 12450
  startingBalance?: number;
  monthlyPnlPercent: number; // e.g. 18.4
  activeRisk: number; // e.g. 1150
}

export function BankrollCard({
  balance = 12450,
  monthlyPnlPercent = 18.4,
  activeRisk = 1200,
}: Partial<BankrollCardProps>) {
  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.25} className="flex flex-col justify-between">
      <BentoHeader
        title="Bankroll Overview"
        subtitle="Tracking capital allocated across all journals"
        action={
          <span className="flex items-center gap-1 text-[11px] font-mono-num font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full border border-[var(--accent)]/20">
            <ShieldCheck className="w-3 h-3" />
            <span>Audited</span>
          </span>
        }
      />

      <div className="my-2 space-y-1">
        <span className="text-xs uppercase font-mono-num text-[var(--muted)]">Liquid Portfolio</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono-num text-[var(--text)] tracking-tight">
            <AnimatedNumber value={balance} prefix="$" />
          </span>
          <span className="inline-flex items-center text-xs font-mono-num text-[var(--win)] font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +{monthlyPnlPercent}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-3 border-t border-[var(--border)] text-xs font-mono-num">
        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase block">Active Exposure</span>
          <span className="font-semibold text-[var(--text)]">${activeRisk.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--muted)] uppercase block">Kelly Metric</span>
          <span className="font-semibold text-[var(--accent)]">Quarter-Kelly (2.5%)</span>
        </div>
      </div>
    </BentoCard>
  );
}
