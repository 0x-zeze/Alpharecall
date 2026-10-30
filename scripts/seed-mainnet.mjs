#!/usr/bin/env node

/**
 * AlphaRecall - Authentic Walrus Memory Mainnet Seeder
 * Writes the canonical real-world settlement records to Walrus Mainnet.
 * Stores verified receipts (blobId, jobId, timestamp, text) to seed-receipts.json.
 * Never outputs fake hashes or Math.random().
 */

import { MemWal } from "@mysten-incubation/memwal";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const key = process.env.MEMWAL_PRIVATE_KEY;
const accountId = process.env.MEMWAL_ACCOUNT_ID;
const serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
const namespace = process.env.MEMWAL_NAMESPACE || "alpharecall";

console.log("\n========================================================");
console.log("  ALPHARECALL - WALRUS MEMORY MAINNET SEEDER");
console.log("========================================================\n");

if (!key || !accountId) {
  console.error("[-] ERROR: Missing MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID in environment.");
  console.log("[i] Generate them at: https://memory.walrus.xyz/dashboard");
  console.log("[i] Set env: export MEMWAL_PRIVATE_KEY=... MEMWAL_ACCOUNT_ID=...\n");
  process.exit(1);
}

// Read canonical demo data from lib/demo-data.ts to guarantee 100% data consistency
const demoDataPath = path.join(__dirname, "../lib/demo-data.ts");
const demoFileContent = fs.readFileSync(demoDataPath, "utf8");

// Parse objects out of the array
const match = demoFileContent.match(/export const DEMO_PREDICTIONS: PredictionRecord\[\] = (\[[\s\S]*?\]);\s*$/);
if (!match) {
  console.error("[-] Could not parse DEMO_PREDICTIONS from lib/demo-data.ts");
  process.exit(1);
}

// Safely evaluate or extract
let CANONICAL_SEEDS;
try {
  // strip typescript type annotations if any
  const cleaned = match[1]
    .replace(/:\s*PredictionRecord\[\]/g, "")
    .replace(/as const/g, "");
  CANONICAL_SEEDS = eval(cleaned);
} catch (e) {
  console.error("[-] Eval error parsing demo data:", e);
  process.exit(1);
}

async function main() {
  console.log(`[*] Initializing MemWal client for namespace: "${namespace}"...`);
  console.log(`[*] Target Relayer: ${serverUrl}`);
  console.log(`[*] Account ID: ${accountId}\n`);

  const memwal = MemWal.create({
    key,
    accountId,
    serverUrl,
    namespace,
  });

  console.log("[*] Checking Relayer Health...");
  await memwal.health();
  console.log("[✓] Relayer is ONLINE and healthy.\n");

  const receipts = [];

  for (let i = 0; i < CANONICAL_SEEDS.length; i++) {
    const item = CANONICAL_SEEDS[i];
    console.log(`[${i + 1}/${CANONICAL_SEEDS.length}] Committing: "${item.title}"`);
    
    // Store full structured JSON payload with source: "walrus"
    const payload = JSON.stringify({
      ...item,
      source: "walrus",
      writeStatus: "confirmed",
    });

    const accepted = await memwal.remember(payload);
    console.log(`      Job ID: ${accepted.job_id}. Waiting for Walrus confirmation...`);
    
    const result = await memwal.waitForRememberJob(accepted.job_id);
    const blobId = result.blob_id;
    console.log(`      [✓] Mainnet blob confirmed! Blob ID: ${blobId}`);
    console.log(`      [✓] Explorer URL: https://walruscan.com/mainnet/blob/${blobId}`);

    receipts.push({
      predictionId: item.id,
      title: item.title,
      blobId,
      jobId: accepted.job_id,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://walruscan.com/mainnet/blob/${blobId}`,
      textPreview: item.content.slice(0, 100),
    });
  }

  // Save authentic receipts to seed-receipts.json
  const receiptsPath = path.join(__dirname, "../seed-receipts.json");
  fs.writeFileSync(receiptsPath, JSON.stringify(receipts, null, 2), "utf8");

  console.log("\n========================================================");
  console.log(`  [SUCCESS] All ${receipts.length} memories verified and written to Walrus Mainnet!`);
  console.log(`  [FILE] Receipts saved to: ${receiptsPath}`);
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("[-] Seeder fatal error:", err);
  process.exit(1);
});
