import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { resolveSafe } from "@/lib/fs";

export async function POST(req: NextRequest) {
  const { path: clientPath } = await req.json();
  if (!clientPath) return NextResponse.json({ error: "path required" }, { status: 400 });

  try {
    const abs = resolveSafe(clientPath);
    await fs.mkdir(abs, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[files/mkdir] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
