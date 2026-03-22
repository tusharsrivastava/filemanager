import { NextResponse } from "next/server";

// CHUNK_SIZE is a server-side runtime env var (no NEXT_PUBLIC_ prefix),
// so it can be set in k8s deployment env without rebuilding the image.
// Default: 512 KiB — safe for nginx's default client_max_body_size of 1 MiB.
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 512 * 1024;

export async function GET() {
  return NextResponse.json({ chunkSize: CHUNK_SIZE });
}
