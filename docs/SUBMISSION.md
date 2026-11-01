# Hackathon Submission Checklist: WalRecall

Submission materials and readiness verification for **Tatum x Walrus Hackathon (Total Recall)** — *Track 1: Markets & Sports Prediction*.

---

## 1. Submission URLs & Assets

| Item | Value / Status | Verification Note |
|---|---|---|
| **Live Application URL** | [https://walrecall.vercel.app](https://walrecall.vercel.app) | Verified live on Vercel production |
| **Public Repository URL** | [https://github.com/0x-zeze/Alpharecall](https://github.com/0x-zeze/Alpharecall) | Branches `main` and `bento-redesign` in sync |
| **Walkthrough Video (2-3 min)** | `TODO: Record and insert video URL (Loom or YouTube)` | Walk through forecast creation, Walrus blob proof, and consensus shift |
| **Technical Blog Post** | `TODO: Publish and insert blog post URL (Medium, Mirror, or Dev.to)` | See outline at `docs/BLOG_OUTLINE.md` |

---

## 2. Submission Form Identifiers (Public Only)

When submitting the official hackathon form, provide these public identifiers.

> **CRITICAL SECURITY NOTICE:**
> - `MEMWAL_AGENT_ID` is the **PUBLIC** Ed25519 delegate address used to verify signatures on Walrus.
> - **NEVER** submit or share `MEMWAL_PRIVATE_KEY`, `TATUM_API_KEY`, `CRON_SECRET`, or `ADMIN_SECRET` in submission forms, public chats, or issues.

| Field Name | Public Identifier | Description |
|---|---|---|
| **Tatum Account / Project ID** | `TODO: Insert Tatum Dashboard Account ID` | Public reference from Tatum dashboard |
| **Sui Wallet Address** | `TODO: Insert Sui wallet address for prize distribution` | 0x... Sui address |
| **Walrus Account Object ID** | `0x5adA78229FCE8EE9fA7dE4Ec17a9Ce4d92416f00` | Onchain Walrus Memory account object |
| **Walrus Agent ID (Delegate Public Key)** | `0x1634b868625be2e0ae7ec1eeb7df4f4142f1f6c77042a98f16ea4bc7df53b1b5` | Derived from delegate keypair (safe to share) |

---

## 3. Submission Deadline Notice

- **Reported Deadline:** Participants report a deadline of **November 10, 2026 at 17:00 UTC**.
- **Official Verification:** Please verify the exact submission window on the official hackathon portal prior to final submission.

---

## 4. Pre-Submission Self-Audit Checklist

- [x] 16 baseline memories verified on Walrus Mainnet with valid `blobId` receipts.
- [x] Official Tatum gRPC integration operational with graceful multi-tier fallback.
- [x] Real-time price oracle operational via Tatum Data API v3.
- [x] Comprehensive test suite passing offline (60 unit tests, 0 failures).
- [x] Production build clean without TypeScript or linting errors.
- [x] Zero API keys or secrets exposed in code, commits, or documentation.
- [ ] 2-3 minute video walkthrough recorded and uploaded.
- [ ] Technical blog post published.
