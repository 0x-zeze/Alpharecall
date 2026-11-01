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
  Activity,
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
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "journal", label: "Prediction Journal", icon: BookOpen },
    { id: "credibility", label: "Credibility Matrix", icon: Award },
    { id: "analytics", label: "Consensus Intel", icon: BarChart3 },
    { id: "bankroll", label: "Bankroll", icon: Wallet },
  ];

  const resolvedTatum = tatumStatus ?? null;
  const resolvedSui = suiChainStatus || suiMetrics || null;

  /* ── Shared telemetry mini-panel (render function, not component) ── */
  const renderTelemetryPanel = () => (
    <div className="space-y-2 pt-3 border-t border-[var(--border)]">
      {/* Tatum Data API */}
      <div className="p-2.5 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] text-[11px] font-mono-num space-y-1.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                resolvedTatum?.status === "live" ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-amber-500/60"
              }`}
            />
            <Server className="w-3 h-3" />
            Tatum Data API
          </span>
          <span className={resolvedTatum?.status === "live" ? "text-[var(--win)] font-semibold" : "text-[var(--muted)]"}>
            {resolvedTatum?.status === "live"
              ? `${resolvedTatum.latencyMs !== null ? `${resolvedTatum.latencyMs}ms · ` : ""}live`
              : "offline"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--muted)]">Plan</span>
          <span className="font-semibold text-[var(--accent-violet)]">
            {resolvedTatum?.status === "live" && resolvedTatum.plan ? resolvedTatum.plan : "—"}
          </span>
        </div>
      </div>

      {/* Sui Checkpoint */}
      <div className="p-2.5 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] text-[11px] font-mono-num space-y-1.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                resolvedSui?.status === "live" ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-amber-500/60"
              }`}
            />
            <Network className="w-3 h-3" />
            Sui Checkpoint
          </span>
          <span className="text-[10px]">
            {resolvedSui?.status === "live" ? "live" : "unavailable"}
          </span>
        </div>
        <div className="flex items-center justify-between font-medium text-[10px]">
          <span className="text-[var(--muted)]">Checkpoint</span>
          <span className={`truncate max-w-[140px] ${resolvedSui?.status === "live" && resolvedSui.checkpoint ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}`}>
            {resolvedSui?.status === "live" && resolvedSui.checkpoint
              ? `#${resolvedSui.checkpoint.slice(-8)} via ${
                  resolvedSui.source === "tatum-grpc"
                    ? "Tatum gRPC"
                    : resolvedSui.source === "tatum-gateway"
                    ? "gateway"
                    : "Sui GraphQL"
                }`
              : "unavailable"}
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

      {/* Walrus Memory Status */}
      <div className="p-2.5 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] text-[11px] space-y-1.5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[var(--muted)] font-mono-num text-[10px]">
            <Database className="w-3 h-3 text-[var(--accent-violet)]" />
            Walrus Memory
          </span>
          <span className={`font-mono-num font-semibold text-[10px] ${isMainnetConnected ? "text-[var(--win)]" : "text-[var(--muted)]"}`}>
            {isMainnetConnected
              ? `${walrusMemoriesCount} blobs`
              : "demo mode"}
          </span>
        </div>

        {process.env.NEXT_PUBLIC_ENABLE_SEED === "true" && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[var(--glass-surface-2)] hover:bg-[var(--accent-violet)]/15 hover:text-[var(--accent-violet)] text-[var(--text-dim)] text-[10px] font-medium transition-all duration-250 border border-transparent hover:border-[var(--accent-violet)]/30 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed 16 Memories"}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent)] flex items-center justify-center text-white font-heading font-bold text-xs shadow-lg shadow-[var(--accent-violet)]/20">
            W
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="font-heading font-bold text-sm text-[var(--text)] tracking-tight">WalRecall</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-amber-500"
                }`}
              />
              <span className="text-[10px] text-[var(--muted)] font-mono-num truncate">
                {isMainnetConnected ? "MAINNET" : "DEMO"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--glass-surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/30 transition-all duration-250"
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-[var(--accent-violet)]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--glass-surface-2)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/30 transition-all duration-250"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-[var(--bg)]/95 backdrop-blur-2xl border-r border-[var(--border)] p-5 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent)] flex items-center justify-center text-white font-heading font-bold text-xs shadow-lg shadow-[var(--accent-violet)]/20">
                  W
                </div>
                <h2 className="font-heading font-bold text-sm text-[var(--text)]">WalRecall</h2>
              </div>
              <button
                ref={closeRef}
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center hover:bg-[var(--glass-surface-2)] transition-all duration-250"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-250 ${
                      isActive
                        ? "bg-[var(--accent-violet)]/10 text-[var(--text)] border border-[var(--accent-violet)]/20"
                        : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--glass-surface-2)]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent-violet)]" : ""}`} />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] shadow-[0_0_6px_var(--accent-violet)]" />
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-4">
              {renderTelemetryPanel()}
            </div>
            <div className="mt-auto pt-4 text-[10px] text-[var(--muted)] font-mono-num text-center">
              Sui Mainnet · Walrus Memory · Tatum gRPC
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--bg)]/60 backdrop-blur-2xl p-5 shrink-0 select-none">
        {/* Brand */}
        <div className="flex items-center gap-3 pb-5 mb-4 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent)] flex items-center justify-center text-white font-heading font-bold text-sm shadow-lg shadow-[var(--accent-violet)]/25">
            W
          </div>
          <div className="leading-tight">
            <h1 className="font-heading font-bold text-sm text-[var(--text)] tracking-tight">WalRecall</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-amber-500"
                }`}
              />
              <span className="text-[10px] text-[var(--muted)] font-mono-num font-medium">
                {isMainnetConnected ? "Sui Mainnet" : "Demo Mode"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-250 ${
                  isActive
                    ? "bg-[var(--accent-violet)]/12 text-[var(--text)] border border-[var(--accent-violet)]/20 shadow-[0_0_12px_-4px_var(--accent-violet)]"
                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--glass-surface-2)] border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent-violet)]" : ""}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] shadow-[0_0_6px_var(--accent-violet)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry */}
        {renderTelemetryPanel()}

        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-1 pt-3 mt-2 border-t border-[var(--border)]">
          <span className="text-[11px] text-[var(--muted)] font-mono-num flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            Appearance
          </span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--glass-surface-2)] border border-[var(--border)] text-[11px] text-[var(--text)] hover:border-[var(--accent-violet)]/30 transition-all duration-250"
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? (
              <>
                <Moon className="w-3 h-3 text-[var(--accent-violet)]" />
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
      </aside>

      {/* ── Mobile bottom bar ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)]/80 border-t border-[var(--border)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-stretch justify-around backdrop-blur-xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-12 py-1.5 transition-all duration-250 ${
                isActive ? "text-[var(--accent-violet)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-mono-num leading-none">{item.label.split(" ")[0]}</span>
              {isActive && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--accent-violet)] shadow-[0_0_8px_var(--accent-violet)]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
