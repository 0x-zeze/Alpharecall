# AlphaRecall 🔮

> **The Decentralized Prediction & Forecaster Credibility Engine that Learns Over Time.**  
> Built for the **Tatum x Walrus Hackathon: Total Recall** ($4,500 Global Prize Pool).  
> **Target Track:** Track 01 — *Markets & Sports Prediction*  
> **Eligible Awards:** Track 01 1st Prize ($500) + Best Walrus Memory ($500) + Best Tatum Integration.

---

## ⚡ Mission & Core Concept

Standard prediction markets and betting trackers suffer from a critical flaw: **they have zero persistent memory**. When an analyst or AI agent makes a terrible forecast, the platform forgets by next week. Users are forced to manually sift through noise, recency bias, and uncalibrated consensus.

**AlphaRecall solves this by giving predictions permanent memory.**
By combining **Tatum Sui RPC & Data APIs** for live onchain verification with **Walrus Memory on Mainnet** (`@mysten-incubation/memwal`), AlphaRecall records every forecast, audits its resolution, and immutably recalibrates forecaster credibility scores across sessions. 

The result is a prediction engine that **actually gets sharper over time**:
- **Sessions 1–5:** Logs predictions across Soccer (EPL, UCL, La Liga), NBA, and SUI/crypto breakouts.
- **Resolution Phase:** Validates game outcomes and onchain price peaks.
- **The Memory Loop:** Queries Walrus Memory using semantic recall (`recall()`), automatically downweighting erratic analysts and elevating verified sharps.

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

- **Frontend:** Next.js 16 (Turbopack, TypeScript, Tailwind CSS).
- **Onchain Infrastructure:** Tatum Gateway JSON-RPC for Sui Mainnet.
- **Decentralized Memory Layer:** Walrus Memory TypeScript SDK (`@mysten-incubation/memwal`).

---

## 📋 Hackathon Submission Compliance Checklist

| Requirement | Implementation Status | Evidence in Code |
|---|---|---|
| **Track 01 Fit** | Markets & Sports prediction journal + credibility scoring | `app/page.tsx`, `lib/walrus.ts` |
| **Walrus Memory Mainnet** | Writes & reads via `@mysten-incubation/memwal` on Mainnet | `lib/walrus.ts`, `app/api/memories` |
| **10+ Memories on Mainnet** | 10 pre-curated prediction audits with one-click seeder | `app/api/seed/route.ts`, `scripts/seed-mainnet.mjs` |
| **Tatum Sui RPC** | Live RPC integration for checkpoint, gas, and balance reads | `lib/tatum.ts`, `app/api/tatum` |
| **Working Demo** | Compiles with Turbopack, zero errors, deployable to Vercel | Verified via `npm run build` |
| **Public Repository** | Clean open-source MIT licensed codebase | Ready for GitHub push |

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/alpharecall.git
cd alpharecall
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your API keys:
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
You can seed directly via CLI:
```bash
npm run seed
```
*Or simply launch the app and click the **"Seed 10 Memories"** button on the top-right of the dashboard.*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## 💡 How AlphaRecall Learns Over Time (The Memory Loop)

1. **Before Memory:** A standard prediction interface weights all user calls equally. When a forecaster fails 3 consecutive high-variance sports totals, users still see their calls at standard 1.0x weight.
2. **With Walrus Memory:**
   - Every resolved game writes a structured audit blob to Walrus Memory.
   - Future queries call `memwal.recall({ query: "forecaster credibility history" })`.
   - The consensus formula adjusts dynamically:
     $$\text{Weight} = \max\left(0.4, 1.0 + \frac{\Delta_{\text{total}}}{20}\right)$$
   - Proven forecasters (like `@TacticalFootyIQ` or `@CourtVisionNBA`) receive up to **2.2x weighting**, while uncalibrated accounts are dampened to **0.6x**.

---

## 📜 License
MIT License. Built for the **Tatum x Walrus Total Recall Hackathon 2026**.
