"use client";

import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Sidebar, NavTab } from "@/components/layout/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { JournalView } from "@/components/journal/JournalView";
import { CredibilityView } from "@/components/credibility/CredibilityView";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { BankrollView } from "@/components/bankroll/BankrollView";
import { DEMO_PREDICTIONS } from "@/lib/demo-data";
import { dedupePredictions } from "@/lib/dedupe";
import { countOnChainBlobs } from "@/lib/dashboard-stats";
import {
  PredictionRecord,
  SuiNodeStatus,
  TatumGatewayStatus,
  SuiChainStatus,
  PredictionCategory,
  SportsFixtureRef,
  SportsMarketRef,
} from "@/lib/types";
import { Sparkles } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [predictions, setPredictions] = useState<PredictionRecord[]>(DEMO_PREDICTIONS);
  const [suiMetrics, setSuiMetrics] = useState<SuiNodeStatus | null>(null);
  const [tatumStatus, setTatumStatus] = useState<TatumGatewayStatus | null>(null);
  const [suiChainStatus, setSuiChainStatus] = useState<SuiChainStatus | null>(null);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMainnetConnected, setIsMainnetConnected] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch live Tatum Sui metrics & Walrus memories
  const fetchData = async () => {
    try {
      const [tatumRes, memRes] = await Promise.all([
        fetch("/api/tatum"),
        fetch("/api/memories"),
      ]);

      const tatumData = await tatumRes.json();
      if (tatumData?.success && tatumData.data) {
        setSuiMetrics(tatumData.data);
        if (tatumData.data.tatum) setTatumStatus(tatumData.data.tatum);
        if (tatumData.data.sui) setSuiChainStatus(tatumData.data.sui);
      }

      const memData = await memRes.json();
      if (memData?.success) {
        setIsMainnetConnected(Boolean(memData.isMainnetConnected));

        if (memData.data?.length > 0) {
          const liveRecords: PredictionRecord[] = memData.data.map((m: Partial<PredictionRecord>, idx: number) => ({
            id: m.id || `live-${idx}`,
            category: m.category || "audit",
            sportType: m.sportType || (m.target?.toLowerCase().includes("sui") || m.target?.toLowerCase().includes("btc") ? "crypto" : "soccer"),
            title: m.title || `Walrus Memory #${idx + 1}`,
            content: m.content || "",
            analyst: m.analyst || "@WalrusSharps",
            target: m.target || "Onchain Market",
            pick: m.pick || "AUDIT",
            odds: m.odds || "-110",
            stake: m.stake || 250,
            pnl: m.pnl || (m.outcome === "ACCURATE" ? 200 : m.outcome === "FAILED" ? -250 : 0),
            outcome: m.outcome || "PENDING",
            credibilityDelta: m.credibilityDelta ?? 0,
            confidence: m.confidence || 4,
            timestamp: m.timestamp || Date.now(),
            dateStr: m.dateStr || new Date(m.timestamp || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            blobId: m.blobId,
            writeStatus: m.writeStatus || "confirmed",
            source: m.source || "walrus",
            reasoning: m.reasoning || m.content,
            deadline: m.deadline,
            direction: m.direction,
            targetPrice: m.targetPrice,
            asset: m.asset,
            suiCheckpoint: m.suiCheckpoint,
            suiCheckpointDigest: m.suiCheckpointDigest,
            suiCheckpointSource: m.suiCheckpointSource,
            oracleFallbackUsed: m.oracleFallbackUsed,
          }));

          // Deduplicate live records and merge with canonical seeds
          const merged = dedupePredictions([...liveRecords, ...DEMO_PREDICTIONS]);
          setPredictions(merged);
        }
      }
    } catch (e) {
      console.warn("Using offline fallback data:", e);
    }
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (active) await fetchData();
    };
    init();
    const interval = setInterval(() => {
      if (active) fetchData();
    }, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSeedMemories = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (res.status === 403) {
        showToast("ℹ Seeding is locked in production without admin secret.");
      } else if (data?.success) {
        showToast("✓ " + (data.message || "Seeding complete!"));
        fetchData();
      } else {
        showToast("Seeding: " + (data?.error || "Unknown"));
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      showToast("Seeding error: " + errStr);
    } finally {
      setSeeding(false);
    }
  };

  const handleAddPrediction = async (data: {
    target: string;
    pick: string;
    sportType: PredictionCategory;
    odds: string;
    stake: number;
    analyst: string;
    confidence: number;
    reasoning?: string;
    deadline?: string;
    direction?: "above" | "below";
    targetPrice?: number;
    asset?: string;
    clientRequestId?: string;
    fixture?: SportsFixtureRef;
    market?: SportsMarketRef;
  }) => {
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${data.target}: ${data.pick}`,
          content: data.reasoning || `Forecast on ${data.target} by ${data.analyst}`,
          analyst: data.analyst,
          target: data.target,
          pick: data.pick,
          category: "prediction",
          odds: data.odds,
          stake: data.stake,
          confidence: data.confidence,
          sportType: data.sportType,
          deadline: data.deadline,
          direction: data.direction,
          targetPrice: data.targetPrice,
          asset: data.asset,
          clientRequestId: data.clientRequestId,
          fixture: data.fixture,
          market: data.market,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData?.success) {
        const errorMsg = resData?.error || `HTTP ${res.status} error`;
        showToast("✗ " + errorMsg);
        return { success: false, error: errorMsg };
      }

      if (resData?.data) {
        // Optimistic state update deduplicated by ID
        setPredictions((prev) => dedupePredictions([resData.data, ...prev]));
      }
      showToast(`✓ Forecast committed! Sui Anchor: ${resData.suiAnchor || "pending"}`);
      fetchData();
      return { success: true };
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      showToast("Error adding prediction: " + errStr);
      return { success: false, error: errStr };
    }
  };

  return (
    <ThemeProvider>
      <div className="flex flex-col md:flex-row min-h-screen bg-[var(--bg)] text-[var(--text)]">
        {/* Toast Notification — Liquid Glass */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-[var(--card)] backdrop-blur-2xl border border-[var(--accent-violet)]/30 text-[var(--accent)] px-4 py-3 rounded-2xl shadow-[0_8px_32px_-4px_rgba(139,124,255,0.25)] animate-in fade-in slide-in-from-top-3 text-xs font-mono-num font-semibold">
            <Sparkles className="w-4 h-4 shrink-0 text-[var(--accent-violet)]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          suiMetrics={suiMetrics}
          tatumStatus={tatumStatus}
          suiChainStatus={suiChainStatus}
          onSeed={handleSeedMemories}
          seeding={seeding}
          walrusMemoriesCount={countOnChainBlobs(predictions)}
          isMainnetConnected={isMainnetConnected}
        />

        {/* Main Work Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              predictions={predictions}
              onNavigateJournal={() => setActiveTab("journal")}
            />
          )}

          {activeTab === "journal" && (
            <JournalView
              predictions={predictions}
              onAddPrediction={handleAddPrediction}
              onRefresh={fetchData}
            />
          )}

          {activeTab === "credibility" && (
            <CredibilityView
              predictions={predictions}
              walrusMemoriesCount={countOnChainBlobs(predictions)}
            />
          )}

          {activeTab === "analytics" && <AnalyticsView />}

          {activeTab === "bankroll" && <BankrollView />}
        </main>
      </div>
    </ThemeProvider>
  );
}
