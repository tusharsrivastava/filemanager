"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface UploadZoneProps {
  onFiles: (files: { file: File; relativePath: string }[]) => void;
  children: React.ReactNode;
}

export function UploadZone({ onFiles, children }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);

  const collect = useCallback(
    async (items: DataTransferItemList): Promise<{ file: File; relativePath: string }[]> => {
      const result: { file: File; relativePath: string }[] = [];

      async function traverseEntry(entry: FileSystemEntry, basePath = "") {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          await new Promise<void>((resolve) => {
            fileEntry.file((f) => {
              result.push({ file: f, relativePath: basePath + f.name });
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const reader = dirEntry.createReader();
          await new Promise<void>((resolve) => {
            reader.readEntries(async (entries) => {
              for (const e of entries) {
                await traverseEntry(e, `${basePath}${dirEntry.name}/`);
              }
              resolve();
            });
          });
        }
      }

      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }

      for (const entry of entries) await traverseEntry(entry);
      return result;
    },
    []
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      counter.current = 0;
      setDragging(false);
      const files = await collect(e.dataTransfer.items);
      if (files.length > 0) onFiles(files);
    },
    [collect, onFiles]
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    counter.current++;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    counter.current--;
    if (counter.current === 0) setDragging(false);
  };

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      {children}
      {dragging && (
        <div
          className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3",
            "bg-background/90 border-2 border-dashed border-primary rounded-lg"
          )}
        >
          <Upload className="h-10 w-10 text-primary" />
          <p className="text-sm font-semibold text-primary">Drop files or folders here</p>
        </div>
      )}
    </div>
  );
}
