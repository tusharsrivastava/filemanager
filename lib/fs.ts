import fs from "fs/promises";
import path from "path";

// Root directory that maps to the PVC mount point.
// In k8s, set MOUNT_PATH=/data (or wherever your PVC is mounted).
// The fallback ./data is for local dev only.
const _cwd: string = process.cwd();
export const ROOT_DIR: string = process.env.MOUNT_PATH ?? path.join(_cwd, "data");

export interface FileEntry {
  name: string;
  path: string;   // relative to ROOT_DIR, always uses forward slashes
  type: "file" | "directory";
  size: number;
  modified: string; // ISO string
  extension: string;
}

/** Resolve a client-supplied relative path to an absolute path safely. */
export function resolveSafe(clientPath: string): string {
  // Normalise: strip leading slashes, collapse traversals
  const normalised = path.normalize(clientPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.join(ROOT_DIR, normalised);

  // Critical guard: never escape ROOT_DIR
  if (!resolved.startsWith(ROOT_DIR + path.sep) && resolved !== ROOT_DIR) {
    throw new Error(`[CRITICAL] Path traversal attempt blocked: "${clientPath}"`);
  }
  return resolved;
}

/** Convert an absolute path back to a forward-slash relative path for the client. */
export function toClientPath(abs: string): string {
  return abs.slice(ROOT_DIR.length).replace(/\\/g, "/") || "/";
}

export async function ensureRootExists() {
  await fs.mkdir(ROOT_DIR, { recursive: true });
}

export async function listDirectory(clientPath: string): Promise<FileEntry[]> {
  const abs = resolveSafe(clientPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  const results = await Promise.all(
    entries.filter((e) => e.name !== ".tmp").map(async (entry) => {
      const entryAbs = path.join(abs, entry.name);
      const stat = await fs.stat(entryAbs).catch(() => null);
      const isDir = entry.isDirectory();
      return {
        name: entry.name,
        path: toClientPath(entryAbs),
        type: (isDir ? "directory" : "file") as FileEntry["type"],
        size: stat?.size ?? 0,
        modified: stat?.mtime.toISOString() ?? new Date().toISOString(),
        extension: isDir ? "" : path.extname(entry.name).toLowerCase().slice(1),
      };
    })
  );

  // Directories first, then alphabetical
  return results.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
