import { NextResponse } from "next/server";
import { saveMemory } from "@/lib/walrus";
import { CANONICAL_SEEDS } from "@/lib/seed-data";

export async function POST() {
  try {
    const results = [];
    for (const item of CANONICAL_SEEDS) {
      const saved = await saveMemory(item);
      results.push(saved);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${results.length} canonical settlement records to Walrus Memory!`,
      count: results.length,
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
