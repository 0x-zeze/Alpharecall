"use client";

import React, { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Sidebar, NavTab } from "@/components/layout/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { JournalView } from "@/components/journal/JournalView";
import { CredibilityView } from "@/components/credibility/CredibilityView";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { BankrollView } from "@/components/bankroll/BankrollView";
import { PredictionRecord, PredictionCategory, SuiNodeStatus } from "@/lib/types";
import { MOCK_PREDICTIONS } from "@/lib/mock-data";
import { Sparkles } from "lucide-react";

export default function AlphaRecallApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [suiMetrics, setSuiMetrics] = useState<SuiNodeStatus | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>(MOCK_PREDICTIONS);
  const [seeding, setSeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMainnetConnected, setIsMainnetConnected] = useState<boolean>(false);
  const [walrusMode, setWalrusMode] = useState<"live" | "demo">("demo");

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
      if (tatumData?.success) {
        setSuiMetrics(tatumData.data);
      }

      const memData = await memRes.json();
      if (memData?.success) {
        setIsMainnetConnected(Boolean(memData.isMainnetConnected));
        setWalrusMode(memData.mode || "demo");

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
            outcome: m.outcome || "ACCURATE",
            credibilityDelta: m.credibilityDelta ?? 5,
            confidence: m.confidence || 4,
            timestamp: m.timestamp || Date.now(),
            dateStr: m.dateStr || new Date(m.timestamp || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            blobId: m.blobId,
            writeStatus: m.writeStatus || "confirmed",
            source: m.source || "walrus",
            reasoning: m.reasoning || m.content,
          }));

          // Merge without duplicates
          const merged = [...liveRecords];
          MOCK_PREDICTIONS.forEach((mp) => {
            if (!merged.some((r) => r.id === mp.id || r.target === mp.target)) {
              merged.push(mp);
            }
          });
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
      if (data?.success) {
        showToast("✓ Successfully committed 10 memories to Walrus Mainnet!");
        fetchData();
      } else {
        showToast("Seeding failed: " + (data?.error || "Unknown"));
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
    reasoning: string;
  }) => {
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${data.target}: ${data.pick}`,
          content: data.reasoning || `Prediction on ${data.target} by ${data.analyst}`,
          analyst: data.analyst,
          target: data.target,
          pick: data.pick,
          outcome: "PENDING",
          credibilityDelta: 0,
          category: "prediction",
          odds: data.odds,
          stake: data.stake,
          confidence: data.confidence,
          sportType: data.sportType,
        }),
      });

      const resData = await res.json();
      if (resData?.success) {
        showToast("✓ Prediction committed to Walrus Memory!");
        fetchData();
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      showToast("Error adding prediction: " + errStr);
    }
  };

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-[var(--card)] border border-[var(--accent)]/40 text-[var(--accent)] px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 text-xs font-mono-num font-semibold">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          suiMetrics={suiMetrics}
          onSeed={handleSeedMemories}
          seeding={seeding}
          walrusMemoriesCount={predictions.length}
          isMainnetConnected={isMainnetConnected}
          walrusMode={walrusMode}
        />

        {/* Main Work Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              predictions={predictions}
              suiMetrics={suiMetrics}
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
              walrusMemoriesCount={predictions.length}
            />
          )}

          {activeTab === "analytics" && <AnalyticsView />}

          {activeTab === "bankroll" && <BankrollView />}
        </main>
      </div>
    </ThemeProvider>
  );
}
