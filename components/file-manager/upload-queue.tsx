"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon } from "./file-icon";
import { formatBytes } from "@/lib/upload";
import { X, CheckCircle2, AlertCircle, Loader2, Minus } from "lucide-react";
import type { UploadItem } from "@/lib/types";

interface UploadQueueProps {
  items: UploadItem[];
  minimized: boolean;
  onDismiss: (id: string) => void;
  onCancel: (id: string) => void;
  onMinimize: () => void;
}

export function UploadQueue({ items, minimized, onDismiss, onCancel, onMinimize }: UploadQueueProps) {
  if (items.length === 0 || minimized) return null;

  const active = items.filter((i) => i.status === "pending" || i.status === "uploading");

  return (
    <div className="fixed top-4 right-4 z-50 w-80 rounded-xl border bg-card shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Uploads</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{active.length} active</Badge>
          <button
            onClick={onMinimize}
            className="text-muted-foreground hover:text-foreground"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ScrollArea className="max-h-72">
        <div className="px-3 py-2 space-y-3">
          {items.map((item) => {
            const isActive = item.status === "pending" || item.status === "uploading";
            return (
              <div key={item.id} className="flex items-start gap-2">
                <div className="pt-0.5 shrink-0">
                  <FileIcon type="file" extension={item.file.name.split(".").pop() ?? ""} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-medium truncate">{item.file.name}</p>
                    <button
                      onClick={() => isActive ? onCancel(item.id) : onDismiss(item.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title={isActive ? "Cancel" : "Dismiss"}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{formatBytes(item.file.size)}</p>
                  {item.status === "uploading" && (
                    <div className="flex items-center gap-2">
                      <Progress value={item.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground w-8 text-right">{item.progress}%</span>
                    </div>
                  )}
                  {item.status === "pending" && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Waiting…</span>
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Done</span>
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      <span className="truncate">{item.error ?? "Failed"}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
