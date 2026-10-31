"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  BarChart3,
  Wallet,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Server,
  Network,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";
import { SuiNodeStatus, TatumGatewayStatus, SuiChainStatus } from "@/lib/types";

export type NavTab = "dashboard" | "journal" | "credibility" | "analytics" | "bankroll";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  suiMetrics?: SuiNodeStatus | null;
  tatumStatus?: TatumGatewayStatus | null;
  suiChainStatus?: SuiChainStatus | null;
  onSeed: () => void;
  seeding: boolean;
  walrusMemoriesCount: number;
  isMainnetConnected?: boolean;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  suiMetrics,
  tatumStatus,
  suiChainStatus,
  onSeed,
  seeding,
  walrusMemoriesCount,
  isMainnetConnected = false,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "credibility", label: "Credibility", icon: Award },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "bankroll", label: "Bankroll", icon: Wallet },
  ];

  // Resolve metrics from either split or legacy props
  const resolvedTatum = tatumStatus || (suiMetrics ? {
    ok: suiMetrics.isTatumGateway,
    status: suiMetrics.isTatumGateway ? "live" : "unavailable",
    plan: "Free",
    creditLimit: 100000,
    latencyMs: suiMetrics.latencyMs,
    version: null,
  } as TatumGatewayStatus : null);

  const resolvedSui = suiChainStatus || suiMetrics;

  return (
    <>
      {/* Mobile top bar — sidebar is hidden below md */}
      <header className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-[10px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-center font-mono-num font-bold text-sm text-[var(--accent)]">
            Ω
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="font-bold text-sm text-[var(--text)] tracking-tight">AlphaRecall</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)]" : "bg-amber-500"
                }`}
              />
              <span className="text-[10px] text-[var(--muted)] font-mono-num truncate">
                {isMainnetConnected ? "LIVE" : "DEMO"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)]"
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-[var(--accent)]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)]"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-[var(--bg)] border-r border-[var(--border)] p-5 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-center font-mono-num font-bold text-sm text-[var(--accent)]">
                  Ω
                </div>
                <h2 className="font-bold text-sm text-[var(--text)]">AlphaRecall</h2>
              </div>
              <button
                ref={closeRef}
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-[8px] border border-[var(--border)] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-3 rounded-[10px] text-sm font-medium ${
                      isActive
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 space-y-1 text-[11px] font-mono-num text-[var(--muted)] border-t border-[var(--border)] pt-3">
              <div className="flex justify-between gap-3">
                <span>Tatum</span>
                <span>{tatumStatus?.status === "live" ? "live" : tatumStatus ? "unavailable" : "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Sui checkpoint</span>
                <span>
                  {suiChainStatus?.status === "live" && suiChainStatus.checkpoint
                    ? `#${suiChainStatus.checkpoint.slice(-8)}`
                    : suiChainStatus
                    ? "unavailable"
                    : "—"}
                </span>
              </div>
            </div>
            <div className="mt-auto pt-4 text-[11px] text-[var(--muted)] font-mono-num">
              <span className={`font-mono-num font-semibold text-[10px] ${isMainnetConnected ? "text-[var(--win)]" : "text-[var(--muted)]"}`}>
                {isMainnetConnected
                  ? `${walrusMemoriesCount} on-chain blobs`
                  : "0 on-chain · local demo"}
              </span>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop / Tablet Left Slim Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--bg)] p-5 shrink-0 select-none">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-center font-mono-num font-bold text-sm text-[var(--accent)]">
            Ω
          </div>
          <div className="leading-tight">
            <h1 className="font-bold text-sm text-[var(--text)] tracking-tight">AlphaRecall</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)]" : "bg-amber-500"
                }`}
              />
              <span className="text-[10px] text-[var(--muted)] font-mono-num font-medium">
                {isMainnetConnected ? "LIVE (Walrus mainnet)" : "DEMO (local, not on-chain)"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-medium transition ${
                  isActive
                    ? "bg-[var(--card)] text-[var(--text)] border border-[var(--border)] shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border-subtle)]/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent)]" : ""}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry & State Boxes */}
        <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
          {/* Box 1: Tatum Data Gateway Telemetry */}
          <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num space-y-1">
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    resolvedTatum?.status === "live" ? "bg-[var(--win)] animate-pulse" : "bg-amber-500"
                  }`}
                />
                <Server className="w-3 h-3" />
                Tatum Data Gateway
              </span>
              <span>
                {resolvedTatum?.status === "live" && resolvedTatum.latencyMs !== null
                  ? `${resolvedTatum.latencyMs}ms`
                  : "offline"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--text)] text-[10px]">
              <span className="text-[var(--muted)]">Plan</span>
              <span className="font-semibold text-[var(--accent)]">
                {resolvedTatum?.status === "live" && resolvedTatum.plan ? resolvedTatum.plan : "—"}
              </span>
            </div>
          </div>

          {/* Box 2: Sui RPC Gateway Telemetry */}
          <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num space-y-1">
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    resolvedSui?.status === "live" ? "bg-[var(--win)] animate-pulse" : "bg-amber-500/60"
                  }`}
                />
                <Network className="w-3 h-3" />
                Sui RPC Node
              </span>
              <span className="text-[10px]">
                {resolvedSui?.status === "live" ? "Connected" : "unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between font-medium text-[var(--text)] text-[10px]">
              <span className="text-[var(--muted)]">Checkpoint</span>
              <span>
                {resolvedSui?.status === "live" && resolvedSui.checkpoint
                  ? `#${resolvedSui.checkpoint.slice(-8)}`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--muted)] text-[10px]">
              <span>Epoch</span>
              <span>
                {resolvedSui?.status === "live" && resolvedSui.epoch
                  ? resolvedSui.epoch
                  : "—"}
              </span>
            </div>
          </div>

          {/* Box 3: Walrus Memory Status & Seeder */}
          <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--muted)] font-mono-num text-[10px]">
                <Database className="w-3 h-3 text-[var(--accent)]" />
                Walrus Mainnet
              </span>
              <span className={`font-mono-num font-semibold text-[10px] ${isMainnetConnected ? "text-[var(--win)]" : "text-[var(--muted)]"}`}>
                {isMainnetConnected
                  ? `${walrusMemoriesCount} on-chain blobs`
                  : "0 on-chain · local demo"}
              </span>
            </div>

            <button
              onClick={onSeed}
              disabled={seeding}
              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-[6px] bg-[var(--border)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] text-[var(--text)] text-[10px] font-medium transition border border-transparent hover:border-[var(--accent)]/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Seeding..." : "Seed 16 Memories"}</span>
            </button>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[11px] text-[var(--muted)] font-mono-num">Appearance</span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[11px] text-[var(--text)] hover:border-[var(--accent)]/40 transition"
              aria-label="Toggle dark/light mode"
            >
              {theme === "dark" ? (
                <>
                  <Moon className="w-3 h-3 text-[var(--accent)]" />
                  <span className="text-[10px]">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px]">Light</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)]/95 border-t border-[var(--border)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-stretch justify-around backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-12 py-1.5 transition ${
                isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-mono-num leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
