import { NextResponse } from "next/server";
import { getAllMemories, saveMemory } from "@/lib/walrus";


export async function GET() {
  try {
    const memories = await getAllMemories();
    return NextResponse.json({
      success: true,
      count: memories.length,
      data: memories,
      isMainnetConnected: Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID),
      namespace: process.env.MEMWAL_NAMESPACE || "alpharecall",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, analyst, target, pick, outcome, credibilityDelta, category } = body;

    if (!title || !target || !pick) {
      return NextResponse.json(
        { success: false, error: "Title, target, and pick are required fields." },
        { status: 400 }
      );
    }

    const saved = await saveMemory({
      title,
      content: content || `Prediction for ${target}: ${pick}`,
      analyst: analyst || "@AnonymousAnalyst",
      target,
      pick,
      outcome: outcome || "PENDING",
      credibilityDelta: credibilityDelta !== undefined ? Number(credibilityDelta) : 0,
      category: category || "prediction",
    });

    return NextResponse.json({
      success: true,
      message: "Memory written successfully",
      record: saved,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
