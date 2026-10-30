"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";

interface RoiCategoryCardProps {
  categories: {
    name: string;
    roi: number; // e.g. 28.4
    pnl: number;
    color: string;
    picksCount: number;
  }[];
}

export function RoiCategoryCard({
  categories = [
    { name: "Crypto (Sui/BTC)", roi: 34.2, pnl: 1404, color: "var(--accent)", picksCount: 9 },
    { name: "Soccer (UCL/EPL)", roi: 22.8, pnl: 692, color: "#a855f7", picksCount: 8 },
    { name: "NBA (Totals/Spreads)", roi: 18.5, pnl: 320, color: "#f97316", picksCount: 5 },
  ],
}: Partial<RoiCategoryCardProps>) {
  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.2} className="flex flex-col justify-between">
      <BentoHeader
        title="ROI by Sector"
        subtitle="Yield distribution across sports and crypto"
      />

      <div className="space-y-3.5 my-1">
        {categories.map((cat) => (
          <div key={cat.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono-num">
              <span className="text-[var(--text)] font-medium">{cat.name}</span>
              <span className="font-bold text-[var(--win)]">
                +<AnimatedNumber value={cat.roi} decimals={1} suffix="%" />
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(cat.roi * 2.5, 100)}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono-num">
              <span>{cat.picksCount} Calls</span>
              <span>+${cat.pnl.toLocaleString()} Net</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Combined Sector ROI</span>
        <span className="text-[var(--accent)] font-semibold">+26.4%</span>
      </div>
    </BentoCard>
  );
}
