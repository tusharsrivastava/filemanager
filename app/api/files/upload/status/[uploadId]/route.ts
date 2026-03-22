import type { NextRequest } from "next/server";
import { getJob } from "@/lib/upload-jobs";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/files/upload/status/[uploadId]">
) {
  const { uploadId } = await ctx.params;
  const job = getJob(uploadId);

  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json(job);
}
