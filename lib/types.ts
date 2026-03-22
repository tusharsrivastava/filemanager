export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  extension: string;
}

export interface UploadItem {
  id: string;
  file: File;
  relativePath: string; // relative path within the dropped folder (empty for flat files)
  destDir: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}
