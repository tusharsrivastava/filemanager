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

export async function uploadChunked(
  file: File,
  destDir: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const CHUNK_SIZE = await getChunkSize();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const filename = file.name;

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error("Upload aborted");

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const form = new FormData();
    form.append("file", chunk);
    form.append("path", destDir);
    form.append("filename", filename);
    form.append("chunkIndex", String(i));
    form.append("totalChunks", String(totalChunks));

    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: form,
      signal,
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error ?? "Upload failed");
    }

    onProgress(Math.round(((i + 1) / totalChunks) * 100));
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
