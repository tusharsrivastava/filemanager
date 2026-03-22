export type JobStatus = "assembling" | "done" | "error";

export interface AssemblyJob {
  status: JobStatus;
  error?: string;
}

// Module-level map persists across requests in the Node.js server process.
const jobs = new Map<string, AssemblyJob>();

export function createJob(uploadId: string): void {
  jobs.set(uploadId, { status: "assembling" });
}

export function resolveJob(uploadId: string, error?: string): void {
  const job = jobs.get(uploadId);
  if (!job) return;
  jobs.set(uploadId, error ? { status: "error", error } : { status: "done" });
}

export function getJob(uploadId: string): AssemblyJob | undefined {
  return jobs.get(uploadId);
}

export function deleteJob(uploadId: string): void {
  jobs.delete(uploadId);
}
