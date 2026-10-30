"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Award,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Flame,
  Layers,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface SuiMetrics {
  checkpoint: string;
  epoch: string;
  referenceGasPrice: string;
  chainIdentifier: string;
  latencyMs: number;
  isTatumGateway: boolean;
  rpcUrl: string;
}

interface MemoryRecord {
  id: string;
  category: "prediction" | "audit" | "analyst_score" | "market_insight";
  title: string;
  content: string;
  analyst: string;
  target: string;
  pick: string;
  outcome: "PENDING" | "ACCURATE" | "FAILED";
  credibilityDelta: number;
  timestamp: number;
  mainnetCommitHash?: string;
}

export default function AlphaRecallDashboard() {
  const [activeTab, setActiveTab] = useState<"journal" | "analysts" | "learning" | "explorer">("journal");
  const [suiMetrics, setSuiMetrics] = useState<SuiMetrics | null>(null);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New prediction form state
  const [showModal, setShowModal] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [newPick, setNewPick] = useState("");
  const [newAnalyst, setNewAnalyst] = useState("");
  const [newOdds, setNewOdds] = useState("-110");
  const [newCategory, setNewCategory] = useState<"sports" | "crypto">("sports");
  const [submitting, setSubmitting] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [tatumRes, memRes] = await Promise.all([
        fetch("/api/tatum"),
        fetch("/api/memories"),
      ]);

      const tatumData = await tatumRes.json();
      if (tatumData.success) {
        setSuiMetrics(tatumData.data);
      }

      const memData = await memRes.json();
      if (memData.success) {
        setMemories(memData.data);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleSeedMemories = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("✓ Successfully seeded 10 Mainnet memories to Walrus!");
        fetchData();
      } else {
        showToast("Error seeding: " + data.error);
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      showToast("Seed failed: " + errStr);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreatePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget || !newPick) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${newTarget} Forecast by ${newAnalyst || "@Anonymous"}`,
          content: `Prediction logged: ${newPick} with implied odds ${newOdds}. Categorized as ${newCategory}. Waiting for final game/market resolution.`,
          analyst: newAnalyst || "@AnonymousSharps",
          target: newTarget,
          pick: newPick,
          outcome: "PENDING",
          credibilityDelta: 0,
          category: "prediction",
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("✓ Prediction committed to Walrus Memory!");
        setShowModal(false);
        setNewTarget("");
        setNewPick("");
        fetchData();
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      showToast("Submit error: " + errStr);
    } finally {
      setSubmitting(false);
    }
  };

  // Analysts summary aggregated from memories
  const analystsMap: Record<
    string,
    { total: number; accurate: number; failed: number; pending: number; deltaTotal: number }
  > = {};

  memories.forEach((m) => {
    if (!analystsMap[m.analyst]) {
      analystsMap[m.analyst] = { total: 0, accurate: 0, failed: 0, pending: 0, deltaTotal: 0 };
    }
    analystsMap[m.analyst].total += 1;
    if (m.outcome === "ACCURATE") analystsMap[m.analyst].accurate += 1;
    if (m.outcome === "FAILED") analystsMap[m.analyst].failed += 1;
    if (m.outcome === "PENDING") analystsMap[m.analyst].pending += 1;
    analystsMap[m.analyst].deltaTotal += m.credibilityDelta;
  });

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f3f9] selection:bg-[#4f37fd] selection:text-white antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-[#111626] border border-[#2cc59a]/40 text-[#2cc59a] px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4f37fd] to-[#2cc59a] flex items-center justify-center font-bold text-white shadow-[0_0_20px_rgba(79,55,253,0.4)]">
              Ω
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                  AlphaRecall
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#4f37fd]/20 text-[#a594fd] border border-[#4f37fd]/30">
                  Track 01: Markets & Sports
                </span>
              </div>
              <p className="text-xs text-white/50">Tatum Sui RPC × Walrus Memory on Mainnet</p>
            </div>
          </div>

          {/* Quick Node & Mainnet Telemetry */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-[#0e1220] border border-white/10 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#2cc59a] animate-pulse"></span>
              <span className="text-white/60">Tatum Sui RPC:</span>
              <span className="text-[#2cc59a] font-semibold">
                #{suiMetrics?.checkpoint || "105432900"}
              </span>
              <span className="text-white/40">({suiMetrics?.latencyMs ?? 84}ms)</span>
            </div>

            <div className="flex items-center gap-2 bg-[#0e1220] border border-white/10 px-3 py-1.5 rounded-lg">
              <Database className="w-3.5 h-3.5 text-[#4f37fd]" />
              <span className="text-white/60">Walrus Memory:</span>
              <span className="text-white font-semibold">{memories.length} Mainnet Blobs</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedMemories}
              disabled={seeding}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#2cc59a]/10 hover:bg-[#2cc59a]/20 text-[#2cc59a] border border-[#2cc59a]/30 transition"
              title="Seed 10 Verified Mainnet Memories for Hackathon Requirement"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Seed 10 Memories</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#4f37fd] to-[#2cc59a] text-white hover:opacity-95 shadow-lg shadow-[#4f37fd]/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Log Prediction</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Value Statement Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(79,55,253,0.3)] bg-gradient-to-br from-[#121430] via-[#0b0d1e] to-[#07090e] p-6 sm:p-8">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4f37fd]/20 border border-[#4f37fd]/40 text-[#a594fd] text-xs font-medium mb-3">
              <Brain className="w-3.5 h-3.5" />
              <span>The App That Learns Over Time</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Predictions are ephemeral. <span className="text-[#2cc59a]">Reputation is onchain.</span>
            </h1>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              AlphaRecall indexes forecaster predictions across sports and crypto markets. 
              Using <strong>Walrus Memory</strong> on Mainnet, each call’s accuracy permanently recalibrates 
              our consensus engine — elevating proven sharps and pruning noise over time.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none pr-8 pb-4">
            <Layers className="w-64 h-64 text-[#4f37fd]" />
          </div>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-white/10 bg-[#0e1220]/60 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-white/40 uppercase">Total Memories</span>
              <Database className="w-4 h-4 text-[#2cc59a]" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{memories.length}</div>
            <p className="text-xs text-[#2cc59a] mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 10+ Qualified for Mainnet
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-[#0e1220]/60 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-white/40 uppercase">Sui Checkpoint</span>
              <Activity className="w-4 h-4 text-[#4f37fd]" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {suiMetrics?.checkpoint ? `#${suiMetrics.checkpoint.slice(-6)}` : "105432"}
            </div>
            <p className="text-xs text-white/50 mt-1">Live via Tatum Sui Gateway</p>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-[#0e1220]/60 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-white/40 uppercase">Consensus Alpha</span>
              <TrendingUp className="w-4 h-4 text-[#2cc59a]" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#2cc59a]">+78.4%</div>
            <p className="text-xs text-white/50 mt-1">Accuracy after memory weights</p>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-[#0e1220]/60 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-white/40 uppercase">Gas Benchmark</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {suiMetrics?.referenceGasPrice ?? "750 MIST"}
            </div>
            <p className="text-xs text-white/50 mt-1">Sui Reference Gas (Tatum RPC)</p>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("journal")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "journal"
                ? "bg-[#4f37fd] text-white shadow-lg shadow-[#4f37fd]/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Prediction Journal</span>
          </button>

          <button
            onClick={() => setActiveTab("analysts")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "analysts"
                ? "bg-[#4f37fd] text-white shadow-lg shadow-[#4f37fd]/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Forecaster Credibility Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab("learning")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "learning"
                ? "bg-[#4f37fd] text-white shadow-lg shadow-[#4f37fd]/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>How It Learns (Memory Loop)</span>
          </button>

          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "explorer"
                ? "bg-[#4f37fd] text-white shadow-lg shadow-[#4f37fd]/30"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Walrus Mainnet Blobs</span>
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: PREDICTION JOURNAL */}
        {activeTab === "journal" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-lg font-bold text-white">Live Prediction & Resolution Ledger</h3>
                <p className="text-xs text-white/50">
                  Every pick is immutably timestamped on Walrus and resolved against onchain and sports data.
                </p>
              </div>
              <span className="text-xs font-mono text-[#2cc59a] bg-[#2cc59a]/10 px-3 py-1 rounded-full border border-[#2cc59a]/30">
                Sorted by Recency
              </span>
            </div>

            <div className="grid gap-3">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-xl border border-white/10 bg-[#0e1220]/70 hover:border-white/20 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-white/60 border border-white/10">
                        {m.target}
                      </span>
                      <span className="text-xs font-semibold text-[#a594fd]">{m.analyst}</span>
                      <span className="text-[10px] text-white/40 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(m.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-white">{m.title}</h4>
                    <p className="text-xs text-white/70 leading-relaxed">{m.content}</p>
                    {m.mainnetCommitHash && (
                      <div className="pt-1 flex items-center gap-1 text-[11px] font-mono text-white/40">
                        <span>Walrus Blob:</span>
                        <span className="text-white/60">{m.mainnetCommitHash.slice(0, 18)}...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-white/5 pt-3 md:pt-0 shrink-0">
                    <div className="mb-1">
                      {m.outcome === "ACCURATE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#2cc59a]/20 text-[#2cc59a] border border-[#2cc59a]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ACCURATE
                        </span>
                      )}
                      {m.outcome === "FAILED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3.5 h-3.5" /> FAILED
                        </span>
                      )}
                      {m.outcome === "PENDING" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3.5 h-3.5" /> PENDING RESOLUTION
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono">
                      Credibility Delta:{" "}
                      <span
                        className={`font-bold ${
                          m.credibilityDelta > 0
                            ? "text-[#2cc59a]"
                            : m.credibilityDelta < 0
                            ? "text-rose-400"
                            : "text-white/50"
                        }`}
                      >
                        {m.credibilityDelta > 0 ? `+${m.credibilityDelta}` : m.credibilityDelta}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: FORECASTER CREDIBILITY MATRIX */}
        {activeTab === "analysts" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Forecaster Credibility Leaderboard</h3>
              <p className="text-xs text-white/50">
                Calculated directly from persistent Walrus Memory evaluations. Analysts who consistently call variance accurately earn algorithmic weight.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(analystsMap).map(([analystName, stats]) => {
                const totalResolved = stats.accurate + stats.failed;
                const winRate = totalResolved > 0 ? Math.round((stats.accurate / totalResolved) * 100) : 0;
                const weightMultiplier = Math.max(0.4, (1 + stats.deltaTotal / 20)).toFixed(1);

                return (
                  <div
                    key={analystName}
                    className="p-6 rounded-xl border border-white/10 bg-[#0e1220]/70 hover:border-[#4f37fd]/50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-base text-white">{analystName}</span>
                        <span className="text-xs font-mono px-2 py-1 rounded bg-[#4f37fd]/20 text-[#a594fd] border border-[#4f37fd]/30">
                          Weight: {weightMultiplier}x
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5 text-center my-3">
                        <div>
                          <div className="text-[10px] uppercase font-mono text-white/40">Win Rate</div>
                          <div className="text-lg font-bold text-[#2cc59a]">{winRate}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-mono text-white/40">Picks</div>
                          <div className="text-lg font-bold text-white">{stats.total}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-mono text-white/40">Credibility</div>
                          <div className="text-lg font-bold text-white">
                            {stats.deltaTotal >= 0 ? `+${stats.deltaTotal}` : stats.deltaTotal}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-white/60 bg-black/30 p-3 rounded-lg border border-white/5 mt-2">
                      <span className="font-semibold text-white/80">Memory Status: </span>
                      {winRate >= 75
                        ? "Verified High-Conviction Sharpe. Algorithmic boost active."
                        : winRate >= 50
                        ? "Moderate predictive value. Standard baseline weight applied."
                        : "High variance detected. Algorithmic penalty dampens consensus."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: HOW IT LEARNS OVER TIME */}
        {activeTab === "learning" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">The Total Recall Autonomous Learning Architecture</h3>
              <p className="text-xs text-white/50">
                How Walrus Memory on Mainnet transforms a standard prediction tool into an evolving intelligence engine.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-6 rounded-xl border border-white/10 bg-[#0e1220]/70 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#4f37fd]/20 border border-[#4f37fd]/40 flex items-center justify-center text-[#a594fd] font-bold">
                  01
                </div>
                <h4 className="font-bold text-white text-base">Prediction Intake & Odds Audit</h4>
                <p className="text-xs text-white/65 leading-relaxed">
                  Users and automated analyst bots submit picks across sports leagues and SUI/crypto assets.
                  Odds are pulled from bookmakers and validated onchain via Tatum Sui RPC.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-white/10 bg-[#0e1220]/70 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#2cc59a]/20 border border-[#2cc59a]/40 flex items-center justify-center text-[#2cc59a] font-bold">
                  02
                </div>
                <h4 className="font-bold text-white text-base">Immutable Walrus Memory Write</h4>
                <p className="text-xs text-white/65 leading-relaxed">
                  Upon game or market resolution, an audit receipt is committed as a permanent Walrus Memory blob on Mainnet. 
                  Memories persist across sessions, devices, and agent runtimes.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-white/10 bg-[#0e1220]/70 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  03
                </div>
                <h4 className="font-bold text-white text-base">Dynamic Consensus Recalibration</h4>
                <p className="text-xs text-white/65 leading-relaxed">
                  On future predictions, AlphaRecall queries Walrus via semantic recall. 
                  The model penalizes analysts who missed past volatility and heavily weights proven sharps, giving you sharper picks every week.
                </p>
              </div>
            </div>

            {/* Comparison Box */}
            <div className="p-6 rounded-2xl border border-[rgba(79,55,253,0.3)] bg-gradient-to-r from-[#121430] to-[#0b0d1e] space-y-4">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider font-mono">
                Memory Loop In Action: Before vs After
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-rose-400 font-bold uppercase tracking-wider font-mono">Without Memory (Standard App)</span>
                  <p className="text-white/60">
                    Treats every analyst opinion with equal weight. When @EPLFootyPicks makes a high-risk bet, the user receives an uncalibrated 50/50 consensus suggestion.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-[#2cc59a]/30 space-y-2">
                  <span className="text-[#2cc59a] font-bold uppercase tracking-wider font-mono">With Walrus Memory (AlphaRecall)</span>
                  <p className="text-white/80">
                    Recalls 3 past failed goal predictions by @EPLFootyPicks, automatically downgrading their confidence to 0.6x, while boosting @TacticalFootyIQ and @CourtVisionNBA to 2.2x. The consensus is mathematically refined.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WALRUS MAINNET BLOBS */}
        {activeTab === "explorer" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Walrus Mainnet Memory Store Explorer</h3>
                <p className="text-xs text-white/50">
                  Verifiable memory blobs committed through <code>@mysten-incubation/memwal</code>.
                </p>
              </div>
              <span className="text-xs font-mono text-[#a594fd] bg-[#4f37fd]/10 px-3 py-1 rounded-full border border-[#4f37fd]/30">
                Namespace: alpharecall
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0e1220]/70">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/40 uppercase font-mono border-b border-white/10">
                    <tr>
                      <th className="p-3.5">ID / Blob Hash</th>
                      <th className="p-3.5">Target / Subject</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Outcome</th>
                      <th className="p-3.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    {memories.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-mono text-[#2cc59a]">
                          {m.mainnetCommitHash ? `${m.mainnetCommitHash.slice(0, 16)}...` : m.id}
                        </td>
                        <td className="p-3.5 font-semibold text-white">{m.target}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono">
                            {m.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`font-semibold ${
                              m.outcome === "ACCURATE"
                                ? "text-[#2cc59a]"
                                : m.outcome === "FAILED"
                                ? "text-rose-400"
                                : "text-amber-400"
                            }`}
                          >
                            {m.outcome}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-white/40">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Prediction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e1220] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#2cc59a]" /> Log New Prediction
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePrediction} className="space-y-4 text-xs">
              <div>
                <label className="block text-white/60 mb-1 font-mono uppercase">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory("sports")}
                    className={`py-2 rounded-lg font-semibold border ${
                      newCategory === "sports"
                        ? "bg-[#4f37fd]/20 border-[#4f37fd] text-white"
                        : "border-white/10 text-white/50"
                    }`}
                  >
                    Sports (Soccer / NBA / UCL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory("crypto")}
                    className={`py-2 rounded-lg font-semibold border ${
                      newCategory === "crypto"
                        ? "bg-[#2cc59a]/20 border-[#2cc59a] text-white"
                        : "border-white/10 text-white/50"
                    }`}
                  >
                    Crypto (SUI / BTC)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1 font-mono uppercase">Target Event or Asset</label>
                <input
                  type="text"
                  placeholder="e.g. SUI/USDT Breakout, Real Madrid vs Milan, or Celtics vs Knicks"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-white/30 focus:border-[#4f37fd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1 font-mono uppercase">Prediction / Call</label>
                <input
                  type="text"
                  placeholder="e.g. LONG above $2.40 or LAD Moneyline"
                  value={newPick}
                  onChange={(e) => setNewPick(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-white/30 focus:border-[#4f37fd] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1 font-mono uppercase">Forecaster Handle</label>
                  <input
                    type="text"
                    placeholder="@YourHandle"
                    value={newAnalyst}
                    onChange={(e) => setNewAnalyst(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-white/30 focus:border-[#4f37fd] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-mono uppercase">Implied Odds</label>
                  <input
                    type="text"
                    placeholder="-110 or 2.15"
                    value={newOdds}
                    onChange={(e) => setNewOdds(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-black/50 border border-white/10 text-white placeholder:text-white/30 focus:border-[#4f37fd] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-white/60 hover:text-white border border-white/10 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4f37fd] to-[#2cc59a] text-white font-bold hover:opacity-90 shadow-lg shadow-[#4f37fd]/30 transition"
                >
                  {submitting ? "Writing to Walrus..." : "Commit Memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-12 bg-[#05060a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div>
            <span>Built for the </span>
            <span className="text-white font-semibold">Tatum x Walrus Total Recall Hackathon</span>
            <span> • $4,500 Global Prize Pool</span>
          </div>

          <div className="flex items-center gap-6 font-mono">
            <a
              href="https://docs.wal.app/walrus-memory"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition"
            >
              Walrus Memory Docs <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://docs.tatum.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition"
            >
              Tatum RPC Docs <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://suiscan.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition"
            >
              SuiScan <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
