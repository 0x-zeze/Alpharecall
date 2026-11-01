"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { BarChart3 } from "lucide-react";

export function AnalyticsView() {
  const leagueData = [
    { name: "Crypto (SUI)", winRate: 85.7, picks: 7, pnl: 1105, fill: "var(--accent)" },
    { name: "Soccer (UCL)", winRate: 83.3, picks: 6, pnl: 702, fill: "#a855f7" },
    { name: "Crypto (BTC)", winRate: 80.0, picks: 5, pnl: 1332, fill: "#38bdf8" },
    { name: "NBA", winRate: 75.0, picks: 4, pnl: 314, fill: "#f97316" },
    { name: "Soccer (EPL)", winRate: 66.7, picks: 6, pnl: 252, fill: "#22c55e" },
    { name: "Soccer (LaLiga)", winRate: 50.0, picks: 4, pnl: -110, fill: "#ef4444" },
  ];

  const oddsRangeData = [
    { range: "Heavy Favs (< -140)", hitRate: 87.5, count: 8 },
    { range: "Slight Favs (-130 to -110)", hitRate: 76.9, count: 13 },
    { range: "Even / Plus (+100 to +125)", hitRate: 72.7, count: 11 },
    { range: "Underdogs (> +130)", hitRate: 60.0, count: 5 },
  ];

  const confidenceData = [
    { level: "5 Stars (Max)", count: 9, hitRate: 88.9, avgPnl: "+$420" },
    { level: "4 Stars (High)", count: 16, hitRate: 81.2, avgPnl: "+$245" },
    { level: "3 Stars (Medium)", count: 8, hitRate: 62.5, avgPnl: "+$85" },
    { level: "2 Stars (Low)", count: 2, hitRate: 50.0, avgPnl: "-$40" },
  ];

  const monthlyPnlData = [
    { month: "Jun", pnl: 340 },
    { month: "Jul", pnl: 480 },
    { month: "Aug", pnl: 620 },
    { month: "Sep", pnl: 890 },
    { month: "Oct", pnl: 1416 },
  ];

  return (
    <div className="space-y-4">
      {/* Top Overview Banner */}
      <div className="liquid-glass p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-[var(--accent-violet)]" />
            <h2 className="text-lg font-heading font-bold text-[var(--text)]">Analytics Intelligence</h2>
          </div>
          <p className="text-xs text-[var(--muted)] max-w-2xl">
            These charts are a fixed demo sample. They are not computed from the current journal.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[var(--glass-surface-1)] px-4 py-2 rounded-xl border border-[var(--border)] font-mono-num text-xs backdrop-blur-sm">
          <span className="text-[11px] font-medium text-amber-400">Simulated sample</span>
        </div>
      </div>

      {/* Grid Row 1: Hit Rate by League/Asset & Monthly PnL Bars */}
      <div className="grid grid-cols-12 gap-4">
        {/* League / Asset Hit Rate */}
        <BentoCard colSpan="col-span-12 lg:col-span-7" delay={0.05}>
          <BentoHeader
            title="Win Rate by League & Asset"
            subtitle="Evaluating hit rates across UEFA, Premier League, NBA, and Sui/BTC"
          />

          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leagueData} layout="vertical" margin={{ top: 5, right: 30, left: 35, bottom: 5 }}>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="var(--muted)"
                  fontSize={10}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--text)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs font-mono-num space-y-1 shadow-xl">
                          <p className="font-bold text-[var(--text)]">{item.name}</p>
                          <p className="text-[var(--accent)]">Win Rate: {item.winRate}%</p>
                          <p className="text-[var(--muted)]">{item.picks} Picks • PnL: +${item.pnl}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="winRate" radius={[0, 6, 6, 0]}>
                  {leagueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Monthly PnL Bars */}
        <BentoCard colSpan="col-span-12 lg:col-span-5" delay={0.1}>
          <BentoHeader
            title="Monthly Profit Progression"
            subtitle="Fixed demo series. Not verified monthly return."
          />

          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPnlData} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                <XAxis
                  dataKey="month"
                  stroke="var(--muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
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
                        <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs font-mono-num shadow-xl">
                          <p className="text-[var(--muted)]">{payload[0].payload.month}</p>
                          <p className="font-bold text-[var(--win)]">+${payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="pnl" fill="var(--win)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>
      </div>

      {/* Grid Row 2: Odds Range vs Hit Rate & Confidence Calibration */}
      <div className="grid grid-cols-12 gap-4">
        {/* Odds Range vs Hit Rate */}
        <BentoCard colSpan="col-span-12 md:col-span-6" delay={0.15}>
          <BentoHeader
            title="Odds Range vs Hit Rate"
            subtitle="Verifying that implied bookmaker probability matches realized outcome"
          />

          <div className="space-y-3.5 my-2 font-mono-num text-xs">
            {oddsRangeData.map((o) => (
              <div key={o.range} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text)]">{o.range}</span>
                  <span className="font-bold text-[var(--win)]">{o.hitRate}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-700"
                    style={{ width: `${o.hitRate}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--muted)] block">{o.count} predictions evaluated</span>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Confidence vs Result */}
        <BentoCard colSpan="col-span-12 md:col-span-6" delay={0.2}>
          <BentoHeader
            title="Confidence Calibration Matrix"
            subtitle="Self-reported conviction levels vs actual settlement rate"
          />

          <div className="space-y-2.5 my-2 font-mono-num text-xs">
            {confidenceData.map((c) => (
              <div
                key={c.level}
                className="p-3 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)] flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-[var(--text)] block">{c.level}</span>
                  <span className="text-[10px] text-[var(--muted)]">{c.count} Total Calls</span>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-[var(--win)] block">{c.hitRate}%</span>
                  <span className="text-[10px] text-[var(--muted)]">{c.avgPnl} Avg Yield</span>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
