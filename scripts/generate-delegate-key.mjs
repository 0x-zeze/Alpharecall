#!/usr/bin/env node

/**
 * Helper to generate an Ed25519 Delegate Keypair for Walrus Memory SDK.
 */

import { generateDelegateKey } from "@mysten-incubation/memwal/account";

async function main() {
  console.log("\n========================================================");
  console.log("  WALRUS MEMORY (MEMWAL) - DELEGATE KEY GENERATOR");
  console.log("========================================================\n");

  const delegate = await generateDelegateKey();

  console.log("[✓] Ed25519 Delegate Keypair Generated Successfully!\n");
  console.log(`• Derived Sui Address : ${delegate.suiAddress}`);
  console.log(`• MEMWAL_PRIVATE_KEY  : ${delegate.privateKey}\n`);

  console.log("--------------------------------------------------------");
  console.log("CARA MENDAPATKAN MEMWAL_ACCOUNT_ID:");
  console.log("1. Buka dashboard resmi: https://memory.walrus.xyz");
  console.log("2. Connect Sui Wallet Anda (Sui Wallet / Slush).");
  console.log("3. Klik 'Create Account' untuk membuat on-chain Account Object.");
  console.log("   (Ini akan menghasilkan MEMWAL_ACCOUNT_ID berupa 0x...)");
  console.log("4. Tambahkan delegate key di atas via tombol 'Add Delegate Key'");
  console.log(`   menggunakan Sui Address: ${delegate.suiAddress}`);
  console.log("5. Masukkan keduanya ke file .env.local:");
  console.log(`   MEMWAL_PRIVATE_KEY=${delegate.privateKey}`);
  console.log(`   MEMWAL_ACCOUNT_ID=0x...`);
  console.log("========================================================\n");
}

main().catch(console.error);
