import { NextResponse } from "next/server";
import { saveMemory, getAllMemories } from "@/lib/walrus";
import { DEMO_PREDICTIONS } from "@/lib/demo-data";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: Request) {
  try {
    // 1. Guard with ADMIN_SECRET in production or when configured
    const adminSecret = process.env.ADMIN_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction || adminSecret) {
      const providedSecret = req.headers.get("x-admin-secret");
      if (!adminSecret || providedSecret !== adminSecret) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Seeding requires valid x-admin-secret." },
          { status: 403 }
        );
      }
    }

    // 2. Enforce Idempotency: fetch existing on-chain memories
    const existing = await getAllMemories();
    const existingIds = new Set(existing.map((m) => m.id));

    const results = [];
    const newReceipts = [];

    // Read existing receipts file if available
    const receiptsPath = path.join(process.cwd(), "seed-receipts.json");
    let storedReceipts = [];
    if (fs.existsSync(receiptsPath)) {
      try {
        storedReceipts = JSON.parse(fs.readFileSync(receiptsPath, "utf8"));
      } catch {
        storedReceipts = [];
      }
    }

    for (const item of DEMO_PREDICTIONS) {
      if (existingIds.has(item.id)) {
        // Skip existing to avoid duplicating memories on Walrus mainnet
        continue;
      }

      const saved = await saveMemory(item);
      results.push(saved);

      // Only record authentic on-chain receipts (must have real blobId)
      if (saved.writeStatus === "confirmed" && saved.blobId) {
        newReceipts.push({
          predictionId: item.id,
          title: item.title,
          blobId: saved.blobId,
          timestamp: new Date().toISOString(),
          explorerUrl: `https://walruscan.com/mainnet/blob/${saved.blobId}`,
          textPreview: item.content.slice(0, 100),
        });
      }
    }

    // Persist verified on-chain receipts
    if (newReceipts.length > 0) {
      const merged = [...storedReceipts, ...newReceipts];
      try {
        fs.writeFileSync(receiptsPath, JSON.stringify(merged, null, 2), "utf8");
      } catch (fsErr) {
        console.warn("Could not append to seed-receipts.json:", fsErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeding completed: ${results.length} written (${DEMO_PREDICTIONS.length - results.length} skipped as already present).`,
      count: results.length,
      skippedCount: DEMO_PREDICTIONS.length - results.length,
      receiptsFile: "seed-receipts.json",
      data: results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
