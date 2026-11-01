#!/usr/bin/env node

/**
 * Helper to submit forward-looking crypto forecasts to WalRecall via the application API.
 * Uses genuine future deadlines (24h to 7 days ahead) so they can be settled dynamically
 * via Tatum Data API once their respective deadlines mature.
 *
 * Usage:
 *   node scripts/post-forward-predictions.mjs [--api=http://localhost:3000] [--days=2]
 */

const args = process.argv.slice(2);
let baseUrl = "http://127.0.0.1:3000";
let daysAhead = 2;

for (const arg of args) {
  if (arg.startsWith("--api=")) {
    baseUrl = arg.split("=")[1].replace(/\/+$/, "");
  } else if (arg.startsWith("--days=")) {
    daysAhead = Math.max(1, Math.min(30, parseInt(arg.split("=")[1], 10) || 2));
  }
}

const now = Date.now();

const sampleForecasts = [
  {
    target: "SUI/USDT Breakout Expansion",
    pick: "SUI > $1.05",
    sportType: "crypto",
    asset: "SUI",
    direction: "above",
    targetPrice: 1.05,
    odds: "+125",
    stake: 300,
    confidence: 4,
    analyst: "@SuiMacroSharps",
    reasoning: "Anticipating mainnet ecosystem liquidity expansion and DEX volume continuation towards $1.05 resistance.",
    deadlineOffsetHours: 24 * daysAhead,
  },
  {
    target: "BTC/USDT Range Expansion Test",
    pick: "BTC > $80,000",
    sportType: "crypto",
    asset: "BTC",
    direction: "above",
    targetPrice: 80000,
    odds: "+140",
    stake: 400,
    confidence: 5,
    analyst: "@BtcQuantAlpha",
    reasoning: "Macro liquidity sweep and weekly consolidation above previous high indicating bullish breakout targeting $80k.",
    deadlineOffsetHours: 24 * (daysAhead + 1),
  },
  {
    target: "ETH/USDT Weekly Support Baseline",
    pick: "ETH > $2,500",
    sportType: "crypto",
    asset: "ETH",
    direction: "above",
    targetPrice: 2500,
    odds: "-110",
    stake: 250,
    confidence: 3,
    analyst: "@EthStructureDesk",
    reasoning: "Defending weekly consolidation block with staking flows stabilizing onchain ratio.",
    deadlineOffsetHours: 24 * (daysAhead + 2),
  },
  {
    target: "SUI/USDT Lower Boundary Stress Test",
    pick: "SUI < $0.78",
    sportType: "crypto",
    asset: "SUI",
    direction: "below",
    targetPrice: 0.78,
    odds: "+210",
    stake: 200,
    confidence: 2,
    analyst: "@VolatilityHedge",
    reasoning: "Downside hedge targeting liquidity sweep below primary trend support if macro pullback triggers.",
    deadlineOffsetHours: 24 * (daysAhead + 3),
  },
];

async function main() {
  console.log("\n========================================================");
  console.log("  ALPHARECALL - FORWARD CRYPTO FORECAST GENERATOR");
  console.log("========================================================");
  console.log(`• Target API Endpoint : ${baseUrl}/api/memories`);
  console.log(`• Base Horizon Target : ${daysAhead} days ahead\n`);

  for (let i = 0; i < sampleForecasts.length; i++) {
    const f = sampleForecasts[i];
    const deadlineMs = now + f.deadlineOffsetHours * 3600 * 1000;
    const deadlineIso = new Date(deadlineMs).toISOString();

    const payload = {
      title: `${f.target}: ${f.pick}`,
      content: f.reasoning,
      target: f.target,
      pick: f.pick,
      sportType: f.sportType,
      asset: f.asset,
      direction: f.direction,
      targetPrice: f.targetPrice,
      odds: f.odds,
      stake: f.stake,
      confidence: f.confidence,
      analyst: f.analyst,
      deadline: deadlineIso,
    };

    console.log(`[${i + 1}/${sampleForecasts.length}] Posting forecast: "${payload.title}"`);
    console.log(`      Deadline: ${deadlineIso}`);

    try {
      const res = await fetch(`${baseUrl}/api/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`      [✓] Committed to Walrus! Blob: ${data.blobId || "local-demo"}, Sui Anchor: ${data.suiAnchor || "none"}`);
      } else {
        console.warn(`      [-] API returned ${res.status}: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(`      [-] Network error connecting to ${baseUrl}:`, err.message);
    }

    // Brief throttle between posts
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n========================================================");
  console.log("  [DONE] All forward predictions submitted through API.");
  console.log("========================================================\n");
}

main().catch(console.error);
