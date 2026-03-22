// Chunk size for uploads.
// nginx's default client_max_body_size is 1 MiB. Multipart form encoding
// adds ~500 bytes of overhead per chunk, so we stay well under that limit.
// If you have configured nginx with client_max_body_size 0 (unlimited) at
// every layer (ingress + any external proxy), you can increase this via the
// NEXT_PUBLIC_CHUNK_SIZE env var (bytes). Example: 10485760 = 10 MiB.
const CHUNK_SIZE = Number(process.env.NEXT_PUBLIC_CHUNK_SIZE) || 512 * 1024;

export async function uploadChunked(
  file: File,
  destDir: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
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
