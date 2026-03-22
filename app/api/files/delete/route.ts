import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { resolveSafe } from "@/lib/fs";

export async function POST(req: NextRequest) {
  const { paths } = await req.json() as { paths: string[] };
  if (!paths?.length) return NextResponse.json({ error: "paths required" }, { status: 400 });

  const errors: string[] = [];
  for (const clientPath of paths) {
    try {
      const abs = resolveSafe(clientPath);
      await fs.rm(abs, { recursive: true, force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[files/delete] ${msg}`);
      if (msg.startsWith("[CRITICAL]")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      errors.push(msg);
    }
  }

  if (errors.length) {
    return NextResponse.json({ ok: false, errors }, { status: 207 });
  }
  return NextResponse.json({ ok: true });
}
