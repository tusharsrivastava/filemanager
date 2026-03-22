import { NextRequest, NextResponse } from "next/server";
import { listDirectory, ensureRootExists } from "@/lib/fs";

export async function GET(req: NextRequest) {
  await ensureRootExists();
  const dir = req.nextUrl.searchParams.get("path") ?? "/";

  try {
    const entries = await listDirectory(dir);
    return NextResponse.json({ entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[files/list] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
