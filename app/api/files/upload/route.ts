import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafe, ensureRootExists } from "@/lib/fs";

// Chunked upload protocol:
//   POST multipart/form-data with fields:
//     file       - the chunk blob
//     path       - destination directory (relative to ROOT_DIR)
//     filename   - final file name
//     chunkIndex - 0-based chunk index
//     totalChunks - total number of chunks
//
// Server assembles chunks in a temp dir under ROOT_DIR/.tmp/<filename>-<totalChunks>/
// On the last chunk it moves the assembled file to destination.

export async function POST(req: NextRequest) {
  await ensureRootExists();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const clientDir = form.get("path") as string | null;
  const filename = form.get("filename") as string | null;
  const chunkIndex = parseInt(form.get("chunkIndex") as string, 10);
  const totalChunks = parseInt(form.get("totalChunks") as string, 10);

  if (!file || !clientDir || !filename || isNaN(chunkIndex) || isNaN(totalChunks)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Sanitise filename: strip path separators so clients cannot write outside target dir
  const safeName = path.basename(filename);
  if (!safeName) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

  try {
    const destDir = resolveSafe(clientDir);
    await fs.mkdir(destDir, { recursive: true });

    // Temp staging area for this upload session
    const { ROOT_DIR } = await import("@/lib/fs");
    const tmpDir = path.join(ROOT_DIR, ".tmp", `${safeName}-${totalChunks}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Write this chunk
    const chunkPath = path.join(tmpDir, `chunk-${chunkIndex}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(chunkPath, buffer);

    console.log(`[upload] ${safeName} chunk ${chunkIndex + 1}/${totalChunks}`);

    // If last chunk, assemble
    if (chunkIndex === totalChunks - 1) {
      const finalPath = path.join(destDir, safeName);

      try {
        // Remove a pre-existing file so we don't inherit its permissions
        await fs.unlink(finalPath).catch(() => {});

        const writeStream = await fs.open(finalPath, "w");
        try {
          for (let i = 0; i < totalChunks; i++) {
            const cp = path.join(tmpDir, `chunk-${i}`);
            const data = await fs.readFile(cp);
            await writeStream.write(data);
          }
        } finally {
          await writeStream.close();
        }
      } finally {
        // Always clean up tmp chunks
        await fs.rm(tmpDir, { recursive: true, force: true });
      }

      console.log(`[upload] ${safeName} assembled successfully → ${finalPath}`);
      return NextResponse.json({ ok: true, done: true });
    }

    return NextResponse.json({ ok: true, done: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[upload][CRITICAL] ${msg}`);
    if (msg.startsWith("[CRITICAL]")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// No bodyParser config needed in App Router — formData() handles it natively
