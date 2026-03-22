import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafe, ensureRootExists } from "@/lib/fs";

export async function POST(req: NextRequest) {
  await ensureRootExists();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const clientDir = form.get("path") as string | null;
  const filename = form.get("filename") as string | null;

  if (!file || !clientDir || !filename) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Sanitise filename: strip path separators so clients cannot write outside target dir
  const safeName = path.basename(filename);
  if (!safeName) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

  try {
    const destDir = resolveSafe(clientDir);
    await fs.mkdir(destDir, { recursive: true });

    const destPath = path.join(destDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destPath, buffer);

    console.log(`[upload] ${safeName} → ${destPath}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[upload] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 300;
