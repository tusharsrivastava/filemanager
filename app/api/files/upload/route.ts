import { NextRequest, NextResponse } from "next/server";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import busboy from "busboy";
import { resolveSafe, ensureRootExists } from "@/lib/fs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  await ensureRootExists();

  return new Promise<NextResponse>((resolve) => {
    const bb = busboy({ headers: Object.fromEntries(req.headers) });

    let clientDir: string | null = null;
    let filename: string | null = null;

    bb.on("field", (name, value) => {
      if (name === "path") clientDir = value;
      if (name === "filename") filename = value;
    });

    bb.on("file", (_fieldname, fileStream, _info) => {
      const safeName = filename ? path.basename(filename) : null;

      if (!safeName || !clientDir) {
        fileStream.resume();
        resolve(NextResponse.json({ error: "Missing required fields" }, { status: 400 }));
        return;
      }

      let destDir: string;
      try {
        destDir = resolveSafe(clientDir);
      } catch (err) {
        fileStream.resume();
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[upload] ${msg}`);
        resolve(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
        return;
      }

      mkdir(destDir, { recursive: true })
        .then(() => {
          const destPath = path.join(destDir, safeName);
          const writeStream = createWriteStream(destPath);

          fileStream.pipe(writeStream);

          writeStream.on("finish", () => {
            console.log(`[upload] ${safeName} → ${destPath}`);
            resolve(NextResponse.json({ ok: true }));
          });

          writeStream.on("error", (err) => {
            console.error(`[upload] write error: ${err.message}`);
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
          });
        })
        .catch((err) => {
          fileStream.resume();
          console.error(`[upload] mkdir error: ${err.message}`);
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
    });

    bb.on("error", (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[upload] busboy error: ${msg}`);
      resolve(NextResponse.json({ error: msg }, { status: 500 }));
    });

    Readable.fromWeb(req.body as import("stream/web").ReadableStream).pipe(bb);
  });
}
