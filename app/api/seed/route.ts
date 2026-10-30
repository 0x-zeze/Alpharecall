import { NextResponse } from "next/server";
import { saveMemory } from "@/lib/walrus";
import { DEMO_PREDICTIONS } from "@/lib/demo-data";
import * as fs from "fs";
import * as path from "path";

export async function POST() {
  try {
    const results = [];
    const receipts = [];

    for (const item of DEMO_PREDICTIONS) {
      const saved = await saveMemory(item);
      results.push(saved);

      receipts.push({
        predictionId: item.id,
        title: item.title,
        blobId: saved.blobId || null,
        writeStatus: saved.writeStatus,
        timestamp: new Date().toISOString(),
        textPreview: item.content.slice(0, 100),
      });
    }

    // Persist verified receipts to seed-receipts.json
    try {
      const receiptsPath = path.join(process.cwd(), "seed-receipts.json");
      fs.writeFileSync(receiptsPath, JSON.stringify(receipts, null, 2), "utf8");
    } catch (fsErr) {
      console.warn("Could not write seed-receipts.json to disk:", fsErr);
    }

    const confirmedCount = results.filter((r) => r.writeStatus === "confirmed").length;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} memories (${confirmedCount} confirmed on Walrus Mainnet, ${results.length - confirmedCount} local/demo).`,
      count: results.length,
      confirmedCount,
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
