// Chunk size is fetched from /api/config at runtime so it can be changed
// via the CHUNK_SIZE k8s env var without rebuilding the image.
let _chunkSize: number | null = null;

async function getChunkSize(): Promise<number> {
  if (_chunkSize !== null) return _chunkSize;
  try {
    const res = await fetch("/api/config");
    const { chunkSize } = await res.json();
    _chunkSize = chunkSize;
  } catch {
    _chunkSize = 512 * 1024; // fallback: 512 KiB
  }
  return _chunkSize!;
}

// Number of chunks sent concurrently. The final chunk is always sent last
// (sequentially) because the server triggers file assembly when it receives it.
const CONCURRENCY = 4;

export async function uploadChunked(
  file: File,
  destDir: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const CHUNK_SIZE = await getChunkSize();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const filename = file.name;

  // Unique ID for this upload session so the server uses a dedicated temp dir.
  // Prevents chunk collisions between concurrent uploads of the same filename
  // and ensures a clean temp dir on every retry.
  // crypto.randomUUID() requires a secure context (HTTPS); fall back to a
  // Math.random-based UUID for plain-HTTP home-network deployments.
  const uploadId = crypto.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });

  async function sendChunk(i: number, abortSignal: AbortSignal): Promise<void> {
    if (abortSignal.aborted) throw new Error("Upload aborted");

    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

    const form = new FormData();
    form.append("file", chunk);
    form.append("path", destDir);
    form.append("filename", filename);
    form.append("chunkIndex", String(i));
    form.append("totalChunks", String(totalChunks));
    form.append("uploadId", uploadId);

    const res = await fetch("/api/files/upload", { method: "POST", body: form, signal: abortSignal });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error ?? "Upload failed");
    }
  }

  // Combine the caller's abort signal with an internal one so we can cancel
  // remaining workers the moment any single chunk fails.
  const workerAbort = new AbortController();
  const workerSignal = signal
    ? AbortSignal.any([signal, workerAbort.signal])
    : workerAbort.signal;

  if (totalChunks === 1) {
    await sendChunk(0, workerSignal);
    onProgress(100);
    return;
  }

  // Send all chunks except the last in parallel (sliding window).
  // The final chunk must arrive last so the server can safely assemble all chunks.
  let completed = 0;
  const queue = Array.from({ length: totalChunks - 1 }, (_, i) => i);

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          if (workerSignal.aborted) break;
          const i = queue.shift()!;
          await sendChunk(i, workerSignal);
          completed++;
          onProgress(Math.round((completed / totalChunks) * 100));
        }
      })
    );
  } catch (err) {
    // Abort remaining workers so they don't keep sending chunks after a failure,
    // which would leave the server temp dir in an unpredictable partial state.
    workerAbort.abort();
    throw err;
  }

  // Send the final chunk to trigger server-side assembly (now async).
  await sendChunk(totalChunks - 1, workerSignal);

  // Poll until the background assembly job completes.
  await pollAssembly(uploadId, workerSignal);
  onProgress(100);
}

async function pollAssembly(uploadId: string, signal: AbortSignal): Promise<void> {
  const POLL_INTERVAL_MS = 1500;

  while (true) {
    if (signal.aborted) throw new Error("Upload aborted");

    const res = await fetch(`/api/files/upload/status/${uploadId}`, { signal });
    if (!res.ok) throw new Error(`Assembly status check failed: ${res.statusText}`);

    const { status, error } = await res.json();

    if (status === "done") return;
    if (status === "error") throw new Error(error ?? "Assembly failed");

    // Still assembling — wait before polling again.
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("Upload aborted"));
      const id = setTimeout(resolve, POLL_INTERVAL_MS);
      signal.addEventListener("abort", () => { clearTimeout(id); reject(new Error("Upload aborted")); }, { once: true });
    });
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
