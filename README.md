# AlphaRecall 🔮

> **Decentralized Prediction & Forecaster Credibility Engine that Learns Over Time.**  
> Minimalist Linear/Apple-inspired Bento Grid Dashboard powered by **Tatum Sui RPC Gateway** and **Walrus Memory on Mainnet**.

---

## ⚡ Mission & Core Concept

Standard prediction markets and betting trackers suffer from a critical flaw: **they have zero persistent memory across sessions**. When an analyst or model makes a terrible forecast, the platform forgets by next week. Users are forced to manually sift through recency bias and uncalibrated consensus.

**AlphaRecall solves this by giving predictions permanent memory.**
By combining **Tatum Sui RPC & Data APIs** for live onchain verification with **Walrus Memory on Mainnet** (`@mysten-incubation/memwal`), AlphaRecall records every forecast, audits its resolution, and immutably recalibrates forecaster credibility scores across sessions. 

The result is a prediction engine that **actually gets sharper over time**:
- **Intake:** Logs predictions across Soccer (UEFA Champions League, Premier League, La Liga), NBA, and SUI/crypto breakouts.
- **Resolution:** Validates match outcomes and onchain price movements via Tatum Sui RPC.
- **The Memory Loop:** Queries Walrus Memory using semantic recall (`recall()`), automatically downweighting erratic analysts ($0.6\times$) and elevating verified sharps ($2.2\times$).

---

## 🎨 UI/UX Bento Grid Design System

AlphaRecall is designed with a **Linear/Apple-inspired minimalist Bento Grid** aesthetic:
- **Clean & Data-First:** High-density 12-column responsive Bento Grid, generous whitespace, zero decorative gradients on cards.
- **Micro-Interactions (Framer Motion):** Staggered card fade-up on page load (`opacity 0->1, y 12->0`), smooth count-up numbers for all metrics, card hover border glow (`#22D3EE` at 30%), and collapsible rows with `AnimatePresence`.
- **Chart Intelligence (Recharts):** Responsive interactive PnL equity curves with 7D/30D/90D/All toggles, SVG radial win rate rings, and monthly profit distribution bars.
- **Theme Support:** Dark mode (default: `#0A0A0B`) and light mode (`#F4F4F5`) toggle with instant CSS variable updates.
- **Typography:** Geist Sans + Geist Mono (numbers strictly formatted with `font-mono-num` and `tabular-nums`).

---

## 🧭 Dashboard Pages & Feature Matrix

1. **Dashboard (Bento Grid):**
   - Cumulative PnL Curve with timeframe filters (7D / 30D / 90D / All).
   - Radial Win Rate progress ring with Hit/Miss/Open breakdown.
   - Current Streak tracker with recent 10 interactive W/L outcome indicators.
   - ROI by Sector (Soccer vs NBA vs Crypto comparative yield bars).
   - Bankroll Overview (active risk exposure and portfolio value).
   - Active Open Predictions with pending status badges.
   - Best & Worst Pick of the Month variance analysis.
   - 35-Day Resolution Heatmap (daily performance grid).
   - Live Tatum Sui Node ticker (Checkpoint height, reference gas in MIST, latency).
   - Restyled "Seed 10 Memories" action button.

2. **Prediction Journal:**
   - Full ledger table with Date, Sector, Market/Event, Pick, Odds, Stake, Status, PnL, and Forecaster.
   - Multi-tier filtering (by Sector, Outcome status, and live search).
   - Expandable inline drawers revealing detailed analytical theses, confidence ratings (1–5 stars), and Walrus Mainnet blob IDs.
   - Interactive slide-over panel with spring animation (`x: 100% -> 0`) for logging and signing new predictions to Walrus Memory.

3. **Forecaster Credibility Matrix:**
   - Real-time leaderboard ranking forecasters by dynamic weighting ($0.4\times$ to $2.2\times$).
   - "Memory Recall" panel showing live Walrus Memory records retrieved across sessions.
   - Before vs After comparison card proving how Walrus Memory dampens bad picks and boosts sharps.

4. **Advanced Analytics:**
   - Win rate categorized by league and asset (UCL, EPL, La Liga, NBA, SUI, BTC).
   - Odds range vs hit rate correlation.
   - Self-reported confidence calibration vs actual settlement accuracy.
   - Monthly net profit progression bars.

5. **Bankroll Management:**
   - Portfolio balance trajectory curve over time.
   - Interactive stake sizing calculator (Quarter-Kelly Criterion vs Flat 2.5% allocation).
   - Verified capital ledger of deposits, settlements, and payouts.

---

## 🛠️ Tech Stack & Architecture

```text
       ┌────────────────────────────────────────────────────────┐
       │                 AlphaRecall Web App                    │
       │    (Next.js App Router, Tailwind CSS, Lucide Icons)     │
       └───────────────────────────┬────────────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
   [ Tatum Sui JSON-RPC Gateway ]       [ Walrus Memory on Mainnet ]
   • Endpoint: sui-mainnet.gateway.tatum.io • SDK: @mysten-incubation/memwal
   • Live Checkpoint Sequence Numbers   • Namespace: "alpharecall"
   • Reference Gas Price (MIST)         • 10+ Immutable Mainnet Blobs
   • Address Balances & Onchain State   • Semantic Recall & Weight Tuning
```

---

## 🚀 Quickstart & Local Setup

### 1. Clone & Install Dependencies
```bash
git clone -b bento-redesign https://github.com/0x-zeze/Alpharecall.git
cd Alpharecall
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Populate with your credentials:
```env
# Tatum API Key from https://dashboard.tatum.io/
TATUM_API_KEY=your_tatum_api_key_here

# Walrus Memory credentials from https://memory.walrus.xyz/dashboard
MEMWAL_PRIVATE_KEY=your_ed25519_private_key_in_hex
MEMWAL_ACCOUNT_ID=your_memwal_account_id_on_sui
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE=alpharecall
```

### 3. Seed 10 Memories to Walrus Mainnet
```bash
npm run seed
```
*(Or click the **"Seed 10 Memories"** button directly in the sidebar of the web app).*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live Bento Grid dashboard.

---

## 📜 License
MIT License.
