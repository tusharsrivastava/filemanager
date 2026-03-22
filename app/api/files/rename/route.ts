import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafe } from "@/lib/fs";

export async function POST(req: NextRequest) {
  const { from, to } = await req.json();
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  try {
    const absFrom = resolveSafe(from);
    // `to` is just a filename (not a path), rename in place
    const absTo = path.join(path.dirname(absFrom), path.basename(to));
    // Verify destination is also within ROOT_DIR
    resolveSafe(absTo.slice(/* strip ROOT_DIR prefix below, verify via resolveSafe */ 0));

    const { ROOT_DIR } = await import("@/lib/fs");
    if (!absTo.startsWith(ROOT_DIR)) {
      throw new Error("[CRITICAL] Rename destination escapes ROOT_DIR");
    }

    await fs.rename(absFrom, absTo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[files/rename] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
