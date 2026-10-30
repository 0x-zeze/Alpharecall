import { NextResponse } from "next/server";
import { getAllMemories, saveMemory, checkWalrusConnection } from "@/lib/walrus";

export async function GET() {
  try {
    const [memories, connectionStatus] = await Promise.all([
      getAllMemories(),
      checkWalrusConnection(),
    ]);

    return NextResponse.json({
      success: true,
      count: memories.length,
      data: memories,
      isMainnetConnected: connectionStatus.isMainnetConnected,
      mode: connectionStatus.mode,
      connectionError: connectionStatus.error,
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
    const {
      title,
      content,
      analyst,
      target,
      pick,
      outcome,
      credibilityDelta,
      category,
      odds,
      stake,
      confidence,
      sportType,
    } = body;

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
      credibilityDelta: credibilityDelta ?? 0,
      category: category || "prediction",
      sportType: sportType || "soccer",
      odds: odds || "-110",
      stake: Number(stake) || 250,
      confidence: Number(confidence) || 4,
    });

    return NextResponse.json({
      success: true,
      data: saved,
      status: saved.writeStatus,
      blobId: saved.blobId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
