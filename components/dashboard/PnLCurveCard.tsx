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

interface PnLCurveCardProps {
  currentPnl: number;
  totalPnlPercent: number;
}

const PNL_DATA_TIMEFRAMES: Record<string, { date: string; pnl: number }[]> = {
  "7D": [
    { date: "Oct 24", pnl: 850 },
    { date: "Oct 25", pnl: 1450 },
    { date: "Oct 26", pnl: 1632 },
    { date: "Oct 27", pnl: 1636 },
    { date: "Oct 28", pnl: 2216 },
    { date: "Oct 29", pnl: 2416 },
    { date: "Oct 30", pnl: 2416 },
  ],
  "30D": [
    { date: "Oct 01", pnl: 0 },
    { date: "Oct 05", pnl: 340 },
    { date: "Oct 10", pnl: 680 },
    { date: "Oct 15", pnl: 894 },
    { date: "Oct 20", pnl: 1219 },
    { date: "Oct 25", pnl: 1632 },
    { date: "Oct 30", pnl: 2416 },
  ],
  "90D": [
    { date: "Aug 01", pnl: -120 },
    { date: "Aug 20", pnl: 450 },
    { date: "Sep 10", pnl: 980 },
    { date: "Sep 30", pnl: 1420 },
    { date: "Oct 15", pnl: 1890 },
    { date: "Oct 30", pnl: 2416 },
  ],
  All: [
    { date: "Jul 01", pnl: 0 },
    { date: "Aug 01", pnl: 410 },
    { date: "Sep 01", pnl: 1120 },
    { date: "Oct 01", pnl: 1750 },
    { date: "Oct 30", pnl: 2416 },
  ],
};

export function PnLCurveCard({ currentPnl, totalPnlPercent }: PnLCurveCardProps) {
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D" | "All">("30D");
  const data = PNL_DATA_TIMEFRAMES[timeframe];

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-8" delay={0.05} className="flex flex-col justify-between">
      <div>
        <BentoHeader
          title="Cumulative PnL Performance"
          subtitle="Simulated PnL from resolved backtest and live picks"
          action={
            <div className="flex items-center gap-1 bg-[var(--border-subtle)] p-1 rounded-[8px] border border-[var(--border)]">
              {(["7D", "30D", "90D", "All"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono-num font-medium transition ${
                    timeframe === tf
                      ? "bg-[var(--card)] text-[var(--accent)] border border-[var(--border)] shadow-xs"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          }
        />

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] font-mono-num">
            <AnimatedNumber value={Math.abs(currentPnl)} prefix={currentPnl >= 0 ? "+$" : "-$"} />
          </span>
          <span className="text-xs font-mono-num px-2 py-0.5 rounded-full bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/20 font-semibold">
            {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent}% of resolved stake
          </span>
        </div>
      </div>

      {/* Recharts Area Container */}
      <div className="h-[210px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="var(--muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] shadow-xl text-xs font-mono-num space-y-1">
                      <p className="text-[var(--muted)]">{payload[0].payload.date}</p>
                      <p className="text-sm font-bold text-[var(--accent)]">
                        +${payload[0].value?.toLocaleString()}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="var(--accent)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#pnlGlow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}
