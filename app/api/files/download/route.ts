import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { resolveSafe } from "@/lib/fs";
import { Readable } from "stream";

export async function GET(req: NextRequest) {
  const clientPath = req.nextUrl.searchParams.get("path");
  if (!clientPath) return NextResponse.json({ error: "path required" }, { status: 400 });

  try {
    const abs = resolveSafe(clientPath);
    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
      return NextResponse.json({ error: "Cannot download a directory directly" }, { status: 400 });
    }

    const filename = path.basename(abs);
    const stream = createReadStream(abs);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[files/download] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
