# AlphaRecall 🔮

> **Decentralized Prediction & Forecaster Credibility Engine that Learns Over Time.**  
> Built for the **Tatum x Walrus Hackathon (Track 1: Markets & Sports Prediction)**.  
> Powered by **Walrus Memory on Mainnet** (`@mysten-incubation/memwal`) and **Tatum Data & RPC Gateway APIs**.

---

## ⚡ Live Links & Resources

* **Live Web App:** [http://43.159.170.31](http://43.159.170.31) *(Production VPS)*
* **Vercel Deployment:** `[Live Demo URL: https://alpharecall.vercel.app]`
* **Demo Video Presentation:** `[Demo Video URL: https://youtu.be/placeholder]`
* **GitHub Repository:** [https://github.com/0x-zeze/Alpharecall](https://github.com/0x-zeze/Alpharecall)
* **Walruscan Explorer (Mainnet):** [https://walruscan.com/mainnet](https://walruscan.com/mainnet)

---

## 🎯 What is AlphaRecall?

Traditional prediction markets and sports tipping platforms suffer from an architectural amnesia: **they have zero persistent, verifiable memory across sessions**. When an analyst or algorithm makes reckless forecasts, the platform forgets within days. Users are left to manually battle recency bias, selective memory, and unweighted consensus.

**AlphaRecall solves this by giving prediction engines permanent onchain memory.**

By combining **Walrus Memory on Mainnet** with **Tatum Data & Sui RPC Gateways**, AlphaRecall tracks every forecast, anchors it to a Sui checkpoint, audits its outcome at maturity, and immutably recalibrates forecaster credibility weights across sessions.

### The Autonomous AlphaRecall Loop

```text
[1. User Creates Forecast] ──► [2. Sui Checkpoint Anchor] ──► [3. Walrus Memory Write]
       │                                                              │
       │                                                              ▼
[6. Weighted Consensus Shift] ◄── [5. Dynamic Credibility Tuning] ◄── [4. Tatum Oracle Settlement]
```

1. **Intake & Sui Anchor:** An analyst logs a forecast (Crypto, Soccer, or NBA). The system fetches the latest Sui Checkpoint sequence from the Tatum Sui RPC Gateway to cryptographically anchor creation time.
2. **Immutable Memory Commitment:** The forecast is encoded into a structured `ALPHARECALL_V1` JSON payload and saved to Walrus Mainnet storage nodes via `@mysten-incubation/memwal`.
3. **Maturity & Resolution:** At the deadline, the resolver queries the Tatum Data API for real-time exchange rates (`/v3/tatum/rate/{symbol}?basePair=USD`).
4. **Adaptive Credibility Tuning:** Outcome accuracy is determined (`ACCURATE` vs `FAILED`), generating an explicit score delta ($\Delta$). A pure mathematical function maps total delta to an analyst weight multiplier:
   $$\text{Weight} = \max\left(0.40, \min\left(2.40, 1.0 + \frac{\Delta_{\text{total}}}{20}\right)\right)$$
5. **Consensus Recalibration:** When evaluating future open markets, the consensus engine multiplies each forecaster's opinion by their memory-weighted credibility, dynamically suppressing bad forecasters ($0.40\times$) and boosting verified sharps ($2.40\times$).

---

## 📊 Live vs Historical Backtest Data

To ensure 100% honesty and data integrity:

* **16 Historical Backtest Seeds (October 2024):** The initial baseline credibility matrix is seeded from real-world audited fixtures from October 2024 (e.g. *El Clasico Real Madrid 0 - 4 FC Barcelona*, *Arsenal 2 - 2 Liverpool*, *Sui $2.00 Breakout*). All 16 records have been cryptographically written to Walrus Mainnet and carry genuine onchain `blobId` receipts.
* **Live User Forecasts:** Any new prediction committed through the UI is saved with status `PENDING` and delta `0`. Crypto predictions require a strict future deadline (up to 30 days) and are settled at maturity via the Tatum Data API.

---

## 📦 Verified Walrus Mainnet Blobs (16 Authentic Records)

Every seed record in AlphaRecall corresponds to an immutable blob stored on Walrus Mainnet:

| # | Market / Event | Blob ID | Explorer Link |
|---|---|---|---|
| 1 | El Clasico: Real Madrid 0 - 4 FC Barcelona | `MDppsKhZlP6LG3FgAOKkiwd-Zs00vZxCNSBD6OkJPZo` | [Walruscan](https://walruscan.com/mainnet/blob/MDppsKhZlP6LG3FgAOKkiwd-Zs00vZxCNSBD6OkJPZo) |
| 2 | Premier League: Arsenal 2 - 2 Liverpool Over 2.5 Goals | `Pvl2qLR-MtlscsT6Xefn1hMa6pKDxgAHUEdUsixPaVE` | [Walruscan](https://walruscan.com/mainnet/blob/Pvl2qLR-MtlscsT6Xefn1hMa6pKDxgAHUEdUsixPaVE) |
| 3 | UEFA Champions League: Real Madrid 5 - 2 Borussia Dortmund | `MlY3RrUcDu9yZqt4azuEqjNU_CAAdkQ1J6-rQSPbU8k` | [Walruscan](https://walruscan.com/mainnet/blob/MlY3RrUcDu9yZqt4azuEqjNU_CAAdkQ1J6-rQSPbU8k) |
| 4 | UEFA Champions League: FC Barcelona 4 - 1 Bayern Munich | `IId5yX8mnya--n6K7fsU_eULIa3GBhJUzSgJ1-F1WO0` | [Walruscan](https://walruscan.com/mainnet/blob/IId5yX8mnya--n6K7fsU_eULIa3GBhJUzSgJ1-F1WO0) |
| 5 | NBA: Boston Celtics 119 - 108 Milwaukee Bucks (-9.5) | `EGTVpuhtIybSbbkAH4YW07k2EC7V0BAxnvxk2-EBXPo` | [Walruscan](https://walruscan.com/mainnet/blob/EGTVpuhtIybSbbkAH4YW07k2EC7V0BAxnvxk2-EBXPo) |
| 6 | NBA: Nikola Jokic Over 26.5 Points (Nuggets vs Raptors) | `_qRNwZHJxnGQGFIYTqNWJB6fmzUAqJTAhjv0_asDHNM` | [Walruscan](https://walruscan.com/mainnet/blob/_qRNwZHJxnGQGFIYTqNWJB6fmzUAqJTAhjv0_asDHNM) |
| 7 | Premier League: West Ham 2 - 1 Manchester United | `BY17qQqMED4GWhhO8bOIs9qN_NErjaRIL5xTyQ1V0CI` | [Walruscan](https://walruscan.com/mainnet/blob/BY17qQqMED4GWhhO8bOIs9qN_NErjaRIL5xTyQ1V0CI) |
| 8 | Sui Ecosystem: SUI Spot Resistance Breakout > $2.00 | `vLRIaRkHJBz6mAcv0FB5gwdtYxa-n59y4Lk8ANBGXRY` | [Walruscan](https://walruscan.com/mainnet/blob/vLRIaRkHJBz6mAcv0FB5gwdtYxa-n59y4Lk8ANBGXRY) |
| 9 | Bitcoin Macro: BTC Spot Liquidity Sweep to $69,450 | `9pWbhl1oxTgTqOiZnA-cQGcc-jXI9T1tId-Jc8bYY0M` | [Walruscan](https://walruscan.com/mainnet/blob/9pWbhl1oxTgTqOiZnA-cQGcc-jXI9T1tId-Jc8bYY0M) |
| 10 | NBA: Los Angeles Lakers 131 - 127 Sacramento Kings | `325ARz4CvVbreH7ARCsuZly3RU5ze2638iDj19WCsCU` | [Walruscan](https://walruscan.com/mainnet/blob/325ARz4CvVbreH7ARCsuZly3RU5ze2638iDj19WCsCU) |
| 11 | Ethereum Macro: ETH/BTC Ratio Breakdown Under 0.038 | `jDG2GmeXgQ5pk_eTfDKTWLwBqEGHbf8y2Fq_pDDzCAk` | [Walruscan](https://walruscan.com/mainnet/blob/jDG2GmeXgQ5pk_eTfDKTWLwBqEGHbf8y2Fq_pDDzCAk) |
| 12 | Premier League: Chelsea 2 - 1 Newcastle United | `_cR7biDzHiTXYmAytnbnVMFmH5DZ64GTnbs6lioLGVw` | [Walruscan](https://walruscan.com/mainnet/blob/_cR7biDzHiTXYmAytnbnVMFmH5DZ64GTnbs6lioLGVw) |
| 13 | UEFA Champions League: Real Madrid vs AC Milan | `TDVgtJ4dxhJhJOb6p2o18tt0vkH4zGzELh4wELA8v3Y` | [Walruscan](https://walruscan.com/mainnet/blob/TDVgtJ4dxhJhJOb6p2o18tt0vkH4zGzELh4wELA8v3Y) |
| 14 | UEFA Champions League: Inter Milan vs Arsenal | `0LM0vnhkdqCqQDYSHVzbqeH94VvDy3f1C40a6AfCBPE` | [Walruscan](https://walruscan.com/mainnet/blob/0LM0vnhkdqCqQDYSHVzbqeH94VvDy3f1C40a6AfCBPE) |
| 15 | NBA: Boston Celtics vs Golden State Warriors Over 228.5 | `7oV_zeh_81qAaAJ1n7kuNES1w2nQDBnSxBh7kZPkCcA` | [Walruscan](https://walruscan.com/mainnet/blob/7oV_zeh_81qAaAJ1n7kuNES1w2nQDBnSxBh7kZPkCcA) |
| 16 | Sui Ecosystem: SUI Spot Re-accumulation Test > $1.85 | `ZFuFsoI9iHgQGvn_gwkZag7XhGYmMxPN5kG3dE50sSA` | [Walruscan](https://walruscan.com/mainnet/blob/ZFuFsoI9iHgQGvn_gwkZag7XhGYmMxPN5kG3dE50sSA) |

*Manifest stored locally at `seed-receipts.json`.*

---

## 🛡️ Security & Reliability Architecture

1. **Client Isolation:** `POST /api/memories` strictly ignores `outcome`, `credibilityDelta`, and `pnl` sent from the client. All new records are initialized to `PENDING` with delta `0`. Only the server-side resolver can commit resolution memories.
2. **Idempotent Settlement:** `POST /api/resolve` recalls existing memories before settlement. If a `predictionId` has already been resolved, it is safely skipped (`status: "skipped"`), preventing duplicate writes or double-counting deltas.
3. **Deadline & Grace Window:** Predictions cannot be settled before their deadline (`status: "not_due"`). A 6-hour `RESOLVER_GRACE_WINDOW_MS` prevents settlement with stale spot prices if triggered days later (`status: "expired-unresolved"`).
4. **Batch Concurrency Guard:** The resolver caps settlements at `MAX_RESOLUTIONS_PER_BATCH = 5` per invocation to fit safely within Vercel serverless execution limits.
5. **Fail-Closed Cron:** `GET /api/resolve` requires an `Authorization: Bearer <CRON_SECRET>` header. If the secret is missing or unset in production, the endpoint fails closed with HTTP 401.
6. **Admin Gated Seeding:** `POST /api/seed` requires an `x-admin-secret: <ADMIN_SECRET>` header in production to prevent unauthorized spam writes to Walrus mainnet storage.
7. **Rate Limiting:** In-memory sliding buckets enforce a 30 predictions/hour per-IP limit and a 200 predictions/day global cap.

---

## ⚠️ Known Limitations

* **Forecaster Identity (Demo Mode):** In the current demo release, analyst handles (e.g. `@OptaTactics`) are entered as text without requiring a cryptographic wallet signature per forecast. Production deployments will require Sui wallet signature verification.
* **Sports Match Settlement:** Automated price resolution is active for crypto markets via the Tatum Data API. Sports matches (Soccer / NBA) are explicitly tagged as `"manual resolution"` and require an official scorecard feed (e.g. ESPN) rather than claiming Tatum oracle settlement.
* **Serverless Rate Limiting:** In-memory rate limiting is best-effort on serverless platforms (like Vercel) where cold starts create fresh process memory. For enterprise multi-region scaling, Upstash Redis or KV is recommended.
* **Public Oracle Fallback:** A guarded CoinGecko fallback is available for local resilience, but strictly disabled by default (`ALLOW_PUBLIC_ORACLE_FALLBACK=false`) to ensure all verified settlements come directly from Tatum.

---

## 🚀 Installation & Local Development

### Prerequisites
* Node.js **>= 22.6.0** (required for native `--experimental-strip-types`)
* npm **>= 10.0.0**

### 1. Clone Repository
```bash
git clone https://github.com/0x-zeze/Alpharecall.git
cd Alpharecall
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials:
```env
# Tatum API Key from https://dashboard.tatum.io/
TATUM_API_KEY=your_tatum_api_key_here

# Walrus Memory credentials from https://memory.walrus.xyz/dashboard
MEMWAL_PRIVATE_KEY=your_ed25519_private_key_in_hex
MEMWAL_ACCOUNT_ID=0x_your_walrus_account_object_id_here
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE=alpharecall

# Security & Cron
CRON_SECRET=your_cron_secret_here
ADMIN_SECRET=your_admin_secret_here
ALLOW_PUBLIC_ORACLE_FALLBACK=false
```

### 4. Delegate Key Generation (Helper)
If you need an Ed25519 delegate key for Walrus Memory:
```bash
npm run keygen
```

### 5. Run Comprehensive Test Suite (Offline, Mock)
```bash
npm test
```
*Executes 29 unit tests covering codec roundtrips, backward compatibility, boundary rules, deadline invariants, idempotency, Tatum parsing, and API security gates.*

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## ☁️ Vercel Deployment Guide

To deploy AlphaRecall to Vercel:

1. Import the repository into your Vercel Dashboard.
2. Configure the following **Environment Variables** in project settings:
   * `TATUM_API_KEY`
   * `MEMWAL_PRIVATE_KEY`
   * `MEMWAL_ACCOUNT_ID`
   * `MEMWAL_SERVER_URL`
   * `MEMWAL_NAMESPACE`
   * `CRON_SECRET`
   * `ADMIN_SECRET`
   * `ALLOW_PUBLIC_ORACLE_FALLBACK`
3. **Build & Output Settings:**
   * Framework Preset: **Next.js**
   * Build Command: `npm run build`
   * Node.js Version: **22.x**

*Note on Cron Triggers: Vercel Hobby plan limits automated cron triggers to once per day. Scheduled resolutions can be triggered via the UI "Check results now" button or via GitHub Actions scheduled workflows.*

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.
