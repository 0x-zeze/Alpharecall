"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Shield, Zap, Search, Calendar } from "lucide-react";
import { CoinLogo } from "@/components/ui/CoinLogo";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { PredictionCategory, SportsFixtureRef, SportsMarketRef } from "@/lib/types";
import { Fixture, SUPPORTED_LEAGUES } from "@/lib/espn";

interface AddPredictionSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
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
  }) => Promise<{ success: boolean; error?: string } | void>;
}

export function AddPredictionSlideOver({
  isOpen,
  onClose,
  onSubmit,
}: AddPredictionSlideOverProps) {
  const [target, setTarget] = useState("");
  const [pick, setPick] = useState("");
  const [sportType, setSportType] = useState<PredictionCategory>("soccer");
  const [odds, setOdds] = useState("-110");
  const [stake, setStake] = useState(250);
  const [analyst, setAnalyst] = useState("");
  const [confidence, setConfidence] = useState(4);
  const [reasoning, setReasoning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAnalystValid = useMemo(() => /^@[A-Za-z0-9_]{2,30}$/.test(analyst.trim()), [analyst]);

  // Synchronous lock to prevent double-tap submissions on mobile/iOS
  const isSubmittingRef = useRef(false);

  // Fresh clientRequestId generated per slide-over open session
  const clientRequestIdRef = useRef<string>("");
  useEffect(() => {
    if (isOpen) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        clientRequestIdRef.current = crypto.randomUUID();
      } else {
        clientRequestIdRef.current = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
    }
  }, [isOpen]);

  // Crypto parameters
  const [deadline, setDeadline] = useState<string>(() => {
    return new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
  });
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [targetPriceInput, setTargetPriceInput] = useState("2.0");
  const [asset, setAsset] = useState("SUI");

  // Sports Fixture Picker State
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState("eng.1");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [fixtureSearch, setFixtureSearch] = useState("");

  // Market Selection
  const [marketType, setMarketType] = useState<"moneyline" | "total">("moneyline");
  const [moneylineSelection, setMoneylineSelection] = useState<"home" | "away" | "draw">("home");
  const [totalSelection, setTotalSelection] = useState<"over" | "under">("over");
  const [totalLineInput, setTotalLineInput] = useState<string>("2.5");

  const handleSelectSportCategory = (cat: PredictionCategory) => {
    setSportType(cat);
    setSelectedFixture(null);
    setFixturesError(null);
    if (cat === "nba") {
      setSelectedLeague("nba");
      setTotalLineInput("224.5");
    } else if (cat === "soccer") {
      setSelectedLeague("eng.1");
      setTotalLineInput("2.5");
    }
  };

  // Fetch upcoming fixtures when sport or league changes
  useEffect(() => {
    if (!isOpen || sportType === "crypto" || isManualEntry) return;

    let isMounted = true;
    const fetchFixtures = async () => {
      setFixturesLoading(true);
      setFixturesError(null);
      try {
        const sportParam = sportType === "nba" ? "nba" : "soccer";
        const leagueParam = sportType === "nba" ? "nba" : selectedLeague;
        const res = await fetch(`/api/fixtures?sport=${sportParam}&league=${leagueParam}&days=7`);
        if (!res.ok) {
          throw new Error("Jadwal tidak tersedia dari ESPN public scoreboard.");
        }
        const data = await res.json();
        if (isMounted) {
          if (data.ok && Array.isArray(data.fixtures)) {
            setFixtures(data.fixtures);
          } else {
            setFixtures([]);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Jadwal pertandingan tidak tersedia.";
          setFixturesError(msg);
          setFixtures([]);
        }
      } finally {
        if (isMounted) setFixturesLoading(false);
      }
    };

    fetchFixtures();
    return () => {
      isMounted = false;
    };
  }, [isOpen, sportType, selectedLeague, isManualEntry]);

  // Group filtered fixtures by local date
  const filteredFixtures = useMemo(() => {
    if (!fixtureSearch.trim()) return fixtures;
    const q = fixtureSearch.toLowerCase();
    return fixtures.filter(
      (f) =>
        f.home.name.toLowerCase().includes(q) ||
        f.away.name.toLowerCase().includes(q) ||
        f.home.abbr.toLowerCase().includes(q) ||
        f.away.abbr.toLowerCase().includes(q)
    );
  }, [fixtures, fixtureSearch]);

  const groupedFixtures = useMemo(() => {
    const groups: Record<string, Fixture[]> = {};
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    for (const f of filteredFixtures) {
      const dateKey = dateFormatter.format(new Date(f.kickoff));
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(f);
    }
    return groups;
  }, [filteredFixtures]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setFormError(null);

    const analystTrimmed = analyst.trim();
    if (!/^@[A-Za-z0-9_]{2,30}$/.test(analystTrimmed)) {
      setFormError("Forecaster handle must start with '@' followed by 2-30 alphanumeric characters or underscores (e.g. @YourHandle).");
      return;
    }

    let finalTarget = target.trim();
    let finalPick = pick.trim();
    let parsedTargetPrice: number | undefined = undefined;
    let deadlineIso: string | undefined = undefined;
    let structuredFixture: SportsFixtureRef | undefined = undefined;
    let structuredMarket: SportsMarketRef | undefined = undefined;

    if (sportType === "crypto") {
      if (!deadline) {
        setFormError("Crypto forecasts require a settlement deadline.");
        return;
      }

      if (!targetPriceInput.trim()) {
        setFormError("Target price is required.");
        return;
      }

      const normalizedPriceStr = targetPriceInput.trim().replace(",", ".");
      parsedTargetPrice = parseFloat(normalizedPriceStr);

      if (isNaN(parsedTargetPrice) || parsedTargetPrice <= 0) {
        setFormError("Target price must be a valid number greater than 0.");
        return;
      }

      deadlineIso = new Date(deadline).toISOString();
      finalTarget = `${asset}/USD`;
      finalPick = `${asset} ${direction === "above" ? ">" : "<"} $${normalizedPriceStr}`;
    } else {
      // Sports sector (NBA or Soccer)
      if (!isManualEntry && selectedFixture) {
        // Structured Fixture Path
        const matchTitle = `${selectedFixture.home.name} vs ${selectedFixture.away.name}`;
        deadlineIso = selectedFixture.kickoff;

        if (marketType === "moneyline") {
          structuredMarket = {
            type: "moneyline",
            selection: moneylineSelection,
          };
          const pickLabel =
            moneylineSelection === "home"
              ? `${selectedFixture.home.name} to Win`
              : moneylineSelection === "away"
              ? `${selectedFixture.away.name} to Win`
              : "Draw";
          finalTarget = matchTitle;
          finalPick = pickLabel;
        } else {
          // Total Over/Under
          const lineVal = parseFloat(totalLineInput.trim().replace(",", "."));
          if (isNaN(lineVal)) {
            setFormError("Garis total harus berupa angka.");
            return;
          }
          if (Math.abs(lineVal % 1) !== 0.5) {
            setFormError("Garis total (line) wajib setengah angka (contoh: 2.5 atau 224.5) untuk mencegah push/seri.");
            return;
          }
          if (sportType === "nba" && (lineVal < 100 || lineVal > 350)) {
            setFormError("Garis total NBA harus berada di antara 100.5 dan 350.5.");
            return;
          }
          if (sportType === "soccer" && (lineVal < 0.5 || lineVal > 9.5)) {
            setFormError("Garis total Soccer harus berada di antara 0.5 dan 9.5.");
            return;
          }

          structuredMarket = {
            type: "total",
            selection: totalSelection,
            line: lineVal,
          };
          finalTarget = matchTitle;
          finalPick = `${totalSelection === "over" ? "Over" : "Under"} ${lineVal} Total Goals/Points`;
        }

        structuredFixture = {
          provider: "espn",
          eventId: selectedFixture.eventId,
          sport: selectedFixture.sport,
          league: selectedFixture.league,
          leagueLabel: selectedFixture.leagueLabel,
          kickoff: selectedFixture.kickoff,
          home: {
            id: selectedFixture.home.id,
            name: selectedFixture.home.name,
            abbr: selectedFixture.home.abbr,
            logo: selectedFixture.home.logo,
          },
          away: {
            id: selectedFixture.away.id,
            name: selectedFixture.away.name,
            abbr: selectedFixture.away.abbr,
            logo: selectedFixture.away.logo,
          },
        };
      } else {
        // Manual entry fallback
        if (!finalTarget || !finalPick) {
          setFormError("Target and Pick are required.");
          return;
        }
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await onSubmit({
        target: finalTarget,
        pick: finalPick,
        sportType,
        odds: odds.trim(),
        stake,
        analyst: analyst.trim(),
        confidence,
        reasoning: reasoning.trim(),
        deadline: deadlineIso,
        direction: sportType === "crypto" ? direction : undefined,
        targetPrice: sportType === "crypto" ? parsedTargetPrice : undefined,
        asset: sportType === "crypto" ? asset : undefined,
        clientRequestId: clientRequestIdRef.current,
        fixture: structuredFixture,
        market: structuredMarket,
      });

      if (res && !res.success && res.error) {
        setFormError(res.error);
        return;
      }

      // Reset form
      setTarget("");
      setPick("");
      setAnalyst("");
      setSelectedFixture(null);
      setTargetPriceInput("2.0");
      setReasoning("");
      setFormError(null);
      setIsManualEntry(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record prediction";
      setFormError(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--bg)]/95 backdrop-blur-2xl border-l border-[var(--border)] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col p-6 overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-5">
              <div>
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--accent)]" />
                  Commit New Forecast
                </h3>
                <p className="text-xs text-[var(--muted)] font-mono-num mt-0.5">
                  Direct cryptographic write to Walrus Memory
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[8px] hover:bg-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Category selector */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px] font-semibold">
                  Prediction Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["soccer", "nba", "crypto"] as PredictionCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectSportCategory(cat)}
                      className={`py-2 px-3 rounded-[8px] border text-center uppercase font-semibold text-[10px] tracking-wide transition min-h-[44px] cursor-pointer ${
                        sportType === cat
                          ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text)]"
                          : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crypto Specific Forecast Settings */}
              {sportType === "crypto" && (
                <div className="p-3.5 rounded-[10px] bg-[var(--bg)] border border-[var(--accent)]/30 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[var(--accent)] font-semibold">
                    <span>Forecast Settlement Parameters</span>
                    <span className="text-[10px] text-[var(--muted)]">Tatum Data Oracle</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label id="crypto-asset-label" className="block text-[var(--muted)] mb-1.5 uppercase text-[9px] font-semibold">
                        Select Asset
                      </label>
                      <div
                        role="radiogroup"
                        aria-labelledby="crypto-asset-label"
                        className="grid grid-cols-3 gap-2"
                      >
                        {[
                          { id: "SUI", name: "Sui" },
                          { id: "BTC", name: "Bitcoin" },
                          { id: "ETH", name: "Ethereum" },
                        ].map((coin) => {
                          const isSelected = asset === coin.id;
                          return (
                            <button
                              key={coin.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setAsset(coin.id)}
                              className={`flex items-center gap-2 p-2 rounded-[8px] border text-left transition min-h-[44px] cursor-pointer ${
                                isSelected
                                  ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text)]"
                                  : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
                              }`}
                            >
                              <CoinLogo symbol={coin.id} size={22} />
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold text-xs text-[var(--text)]">{coin.id}</span>
                                <span className="text-[10px] text-[var(--muted)]">{coin.name}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">Direction</label>
                        <select
                          value={direction}
                          onChange={(e) => setDirection(e.target.value as "above" | "below")}
                          className="w-full px-2 py-2 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] min-h-[44px]"
                        >
                          <option value="above">Above (&gt;=)</option>
                          <option value="below">Below (&lt;=)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">Target Price ($)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          placeholder="e.g. 1.85 or 0,9"
                          value={targetPriceInput}
                          onChange={(e) => setTargetPriceInput(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-xs font-mono-num min-h-[44px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">
                      Settlement Deadline (Required)
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-[11px] min-h-[44px]"
                    />
                    <span className="text-[10px] text-[var(--muted)] block mt-1">
                      Must be strictly in the future (within 30 days). Evaluated via Tatum at deadline.
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono-num space-y-0.5">
                    <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Auto-Generated Target & Pick</div>
                    <div className="text-[var(--text)] text-[11px]">
                      Target: <span className="font-semibold text-[var(--text)]">{asset}/USD</span>
                    </div>
                    <div className="text-[var(--accent)] font-semibold text-[11px]">
                      Pick: {asset} {direction === "above" ? ">" : "<"} ${targetPriceInput.trim().replace(",", ".") || "..."}
                    </div>
                  </div>
                </div>
              )}

              {/* Sports Fixture Picker for Soccer & NBA */}
              {sportType !== "crypto" && !isManualEntry && (
                <div className="space-y-3 p-3.5 rounded-[10px] bg-[var(--bg)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[var(--text)] font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Select Upcoming Match</span>
                    </div>
                    <span className="text-[9px] text-[var(--muted)] font-mono-num">
                      ESPN public scoreboard (unofficial)
                    </span>
                  </div>

                  {/* League Selection for Soccer */}
                  {sportType === "soccer" && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
                      {Object.values(SUPPORTED_LEAGUES)
                        .filter((l) => l.sport === "soccer")
                        .map((l) => (
                          <button
                            key={l.slug}
                            type="button"
                            onClick={() => {
                              setSelectedLeague(l.slug);
                              setSelectedFixture(null);
                            }}
                            className={`px-2.5 py-1 rounded-[6px] shrink-0 border transition min-h-[36px] ${
                              selectedLeague === l.slug
                                ? "bg-[var(--accent)] text-white border-[var(--accent)] font-semibold"
                                : "bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]"
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Search filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama tim..."
                      value={fixtureSearch}
                      onChange={(e) => setFixtureSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-xs placeholder:text-[var(--muted)]/50 focus:outline-none"
                    />
                  </div>

                  {/* Fixtures list scroll box */}
                  <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 border border-[var(--border)]/50 p-2 rounded-[8px] bg-[var(--card)]">
                    {fixturesLoading ? (
                      <div className="py-8 text-center text-[var(--muted)] space-y-2">
                        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-[11px]">Memuat jadwal pertandingan...</p>
                      </div>
                    ) : fixturesError ? (
                      <div className="py-6 text-center text-red-400 space-y-2">
                        <AlertCircle className="w-5 h-5 mx-auto text-red-400" />
                        <p className="text-[11px] font-medium">{fixturesError}</p>
                        <button
                          type="button"
                          onClick={() => setIsManualEntry(true)}
                          className="text-[11px] text-[var(--accent)] underline font-medium"
                        >
                          Isi manual
                        </button>
                      </div>
                    ) : Object.keys(groupedFixtures).length === 0 ? (
                      <div className="py-8 text-center text-[var(--muted)] space-y-1">
                        <p className="font-medium text-[11px]">Tidak ada pertandingan dalam 7 hari ke depan</p>
                        <button
                          type="button"
                          onClick={() => setIsManualEntry(true)}
                          className="text-[11px] text-[var(--accent)] underline"
                        >
                          Isi manual
                        </button>
                      </div>
                    ) : (
                      Object.entries(groupedFixtures).map(([dateLabel, items]) => (
                        <div key={dateLabel} className="space-y-1">
                          <div className="text-[9px] uppercase font-semibold text-[var(--muted)] px-1">
                            {dateLabel}
                          </div>
                          {items.map((f) => {
                            const isSelected = selectedFixture?.eventId === f.eventId;
                            const localTime = new Date(f.kickoff).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            return (
                              <button
                                key={f.eventId}
                                type="button"
                                onClick={() => setSelectedFixture(f)}
                                className={`w-full text-left p-2 rounded-[6px] border transition min-h-[44px] flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text)]"
                                    : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30 hover:text-[var(--text)]"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <TeamLogo logo={f.home.logo} name={f.home.name} abbr={f.home.abbr} size={18} />
                                  <span className="font-semibold text-xs truncate text-[var(--text)]">{f.home.name}</span>
                                  <span className="text-[10px] text-[var(--muted)] shrink-0">vs</span>
                                  <TeamLogo logo={f.away.logo} name={f.away.name} abbr={f.away.abbr} size={18} />
                                  <span className="font-semibold text-xs truncate text-[var(--text)]">{f.away.name}</span>
                                </div>
                                <span className="text-[10px] font-mono-num text-[var(--muted)] shrink-0">{localTime}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Market Selection for Selected Fixture */}
                  {selectedFixture && (
                    <div className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--accent)]/30 space-y-2.5">
                      <div className="text-[10px] text-[var(--accent)] uppercase font-semibold">
                        Pasar Prediksi
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMarketType("moneyline")}
                          className={`py-1.5 px-2 rounded-[6px] border text-center font-semibold text-[10px] min-h-[38px] ${
                            marketType === "moneyline"
                              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                              : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                          }`}
                        >
                          Moneyline (Menang)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarketType("total")}
                          className={`py-1.5 px-2 rounded-[6px] border text-center font-semibold text-[10px] min-h-[38px] ${
                            marketType === "total"
                              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                              : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                          }`}
                        >
                          Total (Over/Under)
                        </button>
                      </div>

                      {marketType === "moneyline" ? (
                        <div className={`grid ${sportType === "soccer" ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                          <button
                            type="button"
                            onClick={() => setMoneylineSelection("home")}
                            className={`p-2 rounded-[6px] border text-center font-semibold text-xs min-h-[44px] truncate ${
                              moneylineSelection === "home"
                                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text)]"
                                : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                            }`}
                          >
                            {selectedFixture.home.shortName}
                          </button>

                          {sportType === "soccer" && (
                            <button
                              type="button"
                              onClick={() => setMoneylineSelection("draw")}
                              className={`p-2 rounded-[6px] border text-center font-semibold text-xs min-h-[44px] ${
                                moneylineSelection === "draw"
                                  ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text)]"
                                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                              }`}
                            >
                              Seri (Draw)
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setMoneylineSelection("away")}
                            className={`p-2 rounded-[6px] border text-center font-semibold text-xs min-h-[44px] truncate ${
                              moneylineSelection === "away"
                                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text)]"
                                : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                            }`}
                          >
                            {selectedFixture.away.shortName}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setTotalSelection("over")}
                              className={`p-2 rounded-[6px] border text-center font-semibold text-xs min-h-[44px] ${
                                totalSelection === "over"
                                  ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text)]"
                                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                              }`}
                            >
                              Over (Di Atas)
                            </button>
                            <button
                              type="button"
                              onClick={() => setTotalSelection("under")}
                              className={`p-2 rounded-[6px] border text-center font-semibold text-xs min-h-[44px] ${
                                totalSelection === "under"
                                  ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text)]"
                                  : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]"
                              }`}
                            >
                              Under (Di Bawah)
                            </button>
                          </div>
                          <div>
                            <label className="block text-[var(--muted)] mb-1 uppercase text-[9px]">
                              Garis Total / Line (Wajib setengah angka, misal: {sportType === "nba" ? "224.5" : "2.5"})
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={totalLineInput}
                              onChange={(e) => setTotalLineInput(e.target.value)}
                              placeholder={sportType === "nba" ? "224.5" : "2.5"}
                              className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono-num text-xs min-h-[44px]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Summary of structured pick */}
                      <div className="pt-2 border-t border-[var(--border)] text-[11px] font-mono-num space-y-0.5">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Ringkasan Terstruktur</div>
                        <div className="text-[var(--text)]">
                          {selectedFixture.home.name} vs {selectedFixture.away.name} ({selectedFixture.leagueLabel})
                        </div>
                        <div className="text-[var(--accent)] font-semibold">
                          Pick:{" "}
                          {marketType === "moneyline"
                            ? moneylineSelection === "home"
                              ? `${selectedFixture.home.name} Menang`
                              : moneylineSelection === "away"
                              ? `${selectedFixture.away.name} Menang`
                              : "Seri (Draw)"
                            : `${totalSelection === "over" ? "Over" : "Under"} ${totalLineInput} Total`}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsManualEntry(true)}
                      className="text-[10px] text-[var(--muted)] hover:text-[var(--accent)] underline"
                    >
                      Pertandingan tidak ada? Isi manual
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Entry Fallback for Soccer / NBA */}
              {sportType !== "crypto" && isManualEntry && (
                <div className="space-y-3 p-3.5 rounded-[10px] bg-[var(--bg)] border border-amber-500/30">
                  <div className="flex items-center justify-between text-amber-500 font-semibold text-[11px]">
                    <span>Mode Entri Manual (Unverified Fixture)</span>
                    <button
                      type="button"
                      onClick={() => setIsManualEntry(false)}
                      className="text-[10px] text-[var(--accent)] underline font-normal"
                    >
                      Kembali ke Pemilih Pertandingan
                    </button>
                  </div>

                  <div>
                    <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                      Target Fixture or Event
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UCL Real Madrid vs AC Milan"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                      Specific Forecast / Pick
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. RMA Win & Over 2.5"
                      value={pick}
                      onChange={(e) => setPick(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {/* Odds & Stake */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Implied Odds
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="-110 or +145"
                    value={odds}
                    onChange={(e) => setOdds(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Stake Amount ($)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    required
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Forecaster & Confidence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Forecaster Handle (@handle) *
                  </label>
                  <input
                    type="text"
                    required
                    pattern="^@[A-Za-z0-9_]{2,30}$"
                    placeholder="@YourHandle"
                    value={analyst}
                    onChange={(e) => setAnalyst(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                  />
                  {!isAnalystValid && analyst.length > 0 && (
                    <span className="text-[10px] text-[var(--loss)] mt-1 block">
                      Handle must start with @ followed by 2-30 alphanumeric characters or underscores (e.g. @YourHandle).
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                    Confidence (1-5 Stars)
                  </label>
                  <select
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none min-h-[44px]"
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>
                        {num} Star{num > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <label className="block text-[var(--muted)] mb-1.5 uppercase text-[10px]">
                  Analysis Reasoning / Model Signal
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide qualitative context, model signals, or game script reasoning..."
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isAnalystValid || (sportType !== "crypto" && !isManualEntry && !selectedFixture)}
                className="w-full py-3 px-4 rounded-[8px] bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Committing to Walrus Mainnet...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Commit Immutable Memory</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
