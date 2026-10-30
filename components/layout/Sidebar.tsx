"use client";

import React from "react";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  BarChart3,
  Wallet,
  Sun,
  Moon,
  Database,
  Activity,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";
import { SuiNodeStatus } from "@/lib/types";

export type NavTab = "dashboard" | "journal" | "credibility" | "analytics" | "bankroll";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  suiMetrics: SuiNodeStatus | null;
  onSeed: () => void;
  seeding: boolean;
  walrusMemoriesCount: number;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  suiMetrics,
  onSeed,
  seeding,
  walrusMemoriesCount,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "credibility", label: "Credibility", icon: Award },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "bankroll", label: "Bankroll", icon: Wallet },
  ];

  return (
    <>
      {/* Desktop / Tablet Left Slim Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--bg)] p-5 shrink-0 select-none">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 pb-6 mb-2 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-center font-mono-num font-bold text-sm text-[var(--accent)]">
            Ω
          </div>
          <div className="leading-tight">
            <span className="font-semibold text-sm tracking-tight text-[var(--text)] block">
              AlphaRecall
            </span>
            <span className="text-[11px] text-[var(--muted)] font-mono-num block">
              v1.0 • Walrus × Tatum
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-xs font-medium transition duration-150 ${
                  isActive
                    ? "bg-[var(--card)] text-[var(--text)] border border-[var(--border)] shadow-sm font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)]/50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                />
                <span>{item.label}</span>
                {item.id === "credibility" && (
                  <span className="ml-auto text-[10px] font-mono-num px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                    2.2x
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Network & Live State Box */}
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          {/* Tatum Live Ticker */}
          <div className="p-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num space-y-1.5">
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    suiMetrics?.status === "live" ? "bg-[var(--win)] animate-pulse" : "bg-amber-500"
                  }`}
                />
                Tatum Sui Gateway
              </span>
              <span>
                {suiMetrics?.status === "live" && suiMetrics.latencyMs !== null
                  ? `${suiMetrics.latencyMs}ms`
                  : "offline"}
              </span>
            </div>
            <div className="flex items-center justify-between font-medium text-[var(--text)]">
              <span>Checkpoint</span>
              <span>
                {suiMetrics?.status === "live" && suiMetrics.checkpoint
                  ? `#${suiMetrics.checkpoint.slice(-6)}`
                  : "unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Reference Gas</span>
              <span>
                {suiMetrics?.status === "live" && suiMetrics.referenceGasPrice
                  ? suiMetrics.referenceGasPrice
                  : "pending"}
              </span>
            </div>
          </div>

          {/* Walrus Memory Status & Seeder */}
          <div className="p-3 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[11px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--muted)] font-mono-num">
                <Database className="w-3.5 h-3.5 text-[var(--accent)]" />
                Walrus Mainnet
              </span>
              <span className="font-mono-num font-semibold text-[var(--win)] text-[10px]">
                {walrusMemoriesCount} Blobs
              </span>
            </div>

            <button
              onClick={onSeed}
              disabled={seeding}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-[8px] bg-[var(--border)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] text-[var(--text)] text-[11px] font-medium transition border border-transparent hover:border-[var(--accent)]/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Writing to Mainnet..." : "Seed 10 Memories"}</span>
            </button>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-[var(--muted)] font-mono-num">Appearance</span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text)] hover:border-[var(--accent)]/40 transition"
              aria-label="Toggle dark/light mode"
            >
              {theme === "dark" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="text-[11px]">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px]">Light</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md px-3 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition ${
                isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
