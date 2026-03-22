"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Download, Pencil, Trash2, FolderOpen,
  ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import { FileIcon } from "./file-icon";
import { Toolbar } from "./toolbar";
import { UploadZone } from "./upload-zone";
import { UploadQueue } from "./upload-queue";
import { RenameDialog } from "./rename-dialog";
import { NewFolderDialog } from "./new-folder-dialog";
import { uploadChunked, formatBytes, formatDate } from "@/lib/upload";
import type { FileEntry, UploadItem } from "@/lib/types";

let uploadCounter = 0;

export function FileBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPathRef = useRef(searchParams.get("path") ?? "/");

  const [currentPath, setCurrentPath] = useState(initialPathRef.current);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadMinimized, setUploadMinimized] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const cancelledIds = useRef<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // ── Fetch directory listing ──────────────────────────────────────────────
  const fetchDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setEntries(data.entries);
      setCurrentPath(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error(`[FileBrowser] ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDir(initialPathRef.current); }, [fetchDir]);

  // Sync current path into URL so refresh restores the same directory
  useEffect(() => {
    const qs = currentPath !== "/" ? `?path=${encodeURIComponent(currentPath)}` : "";
    router.replace(`/${qs}`, { scroll: false });
  }, [currentPath, router]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const navigate = (entry: FileEntry) => {
    if (entry.type === "directory") {
      fetchDir(entry.path);
    }
  };

  // ── Breadcrumb segments ──────────────────────────────────────────────────
  const breadcrumbSegments = (() => {
    const parts = currentPath.replace(/^\//, "").split("/").filter(Boolean);
    return [
      { label: "Root", path: "/" },
      ...parts.map((p, i) => ({
        label: p,
        path: "/" + parts.slice(0, i + 1).join("/"),
      })),
    ];
  })();

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        next.has(path) ? next.delete(path) : next.add(path);
      } else {
        if (next.size === 1 && next.has(path)) next.clear();
        else { next.clear(); next.add(path); }
      }
      return next;
    });
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (paths?: string[]) => {
    const toDelete = paths ?? Array.from(selected);
    if (!toDelete.length) return;

    const res = await fetch("/api/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: toDelete }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`Deleted ${toDelete.length} item(s)`);
    } else {
      toast.error("Some deletions failed");
      console.error("[FileBrowser/delete]", data.errors);
    }
    fetchDir(currentPath);
  };

  // ── Rename ───────────────────────────────────────────────────────────────
  const handleRename = async (newName: string) => {
    if (!renaming) return;
    const res = await fetch("/api/files/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: renaming.path, to: newName }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success(`Renamed to "${newName}"`);
    } else {
      toast.error(data.error ?? "Rename failed");
      console.error("[FileBrowser/rename]", data.error);
    }
    setRenaming(null);
    fetchDir(currentPath);
  };

  // ── New folder ───────────────────────────────────────────────────────────
  const handleNewFolder = async (name: string) => {
    const newPath = currentPath.replace(/\/$/, "") + "/" + name;
    const res = await fetch("/api/files/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: newPath }),
    });
    const data = await res.json();
    if (data.ok) toast.success(`Folder "${name}" created`);
    else { toast.error(data.error ?? "Failed to create folder"); console.error("[FileBrowser/mkdir]", data.error); }
    setNewFolderOpen(false);
    fetchDir(currentPath);
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = (entry: FileEntry) => {
    const a = document.createElement("a");
    a.href = `/api/files/download?path=${encodeURIComponent(entry.path)}`;
    a.download = entry.name;
    a.click();
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleFiles = useCallback(
    async (files: { file: File; relativePath: string }[]) => {
      const newItems: UploadItem[] = files.map(({ file, relativePath }) => {
        // Derive destination dir from relative path (strip filename)
        const parts = relativePath.split("/");
        const subDir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        const destDir = subDir
          ? currentPath.replace(/\/$/, "") + "/" + subDir
          : currentPath;

        return {
          id: String(++uploadCounter),
          file,
          relativePath,
          destDir,
          progress: 0,
          status: "pending",
        };
      });

      setUploads((prev) => [...prev, ...newItems]);
      setUploadMinimized(false);

      // Upload sequentially to avoid overwhelming the server
      for (const item of newItems) {
        if (cancelledIds.current.has(item.id)) {
          cancelledIds.current.delete(item.id);
          continue;
        }

        const controller = new AbortController();
        abortControllers.current.set(item.id, controller);

        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: "uploading" } : u))
        );
        try {
          await uploadChunked(item.file, item.destDir, (pct) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
            );
          }, controller.signal);
          abortControllers.current.delete(item.id);
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, status: "done", progress: 100 } : u))
          );
          toast.success(`Uploaded ${item.file.name}`);
        } catch (e) {
          abortControllers.current.delete(item.id);
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "Upload aborted") continue;
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, status: "error", error: msg } : u))
          );
          toast.error(`Failed: ${item.file.name}`);
          console.error(`[FileBrowser/upload] ${item.file.name}: ${msg}`);
        }
      }

      fetchDir(currentPath);
    },
    [currentPath, fetchDir]
  );

  const dismissUpload = (id: string) =>
    setUploads((prev) => prev.filter((u) => u.id !== id));

  const cancelUpload = (id: string) => {
    cancelledIds.current.add(id);
    abortControllers.current.get(id)?.abort();
    abortControllers.current.delete(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <span className="font-bold text-base tracking-tight">K8s File Manager</span>
        <Badge variant="secondary" className="text-xs font-mono">{currentPath}</Badge>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 border-b bg-muted/20">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbSegments.map((seg, i) => (
              <span key={seg.path} className="flex items-center gap-1">
                {i < breadcrumbSegments.length - 1 ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        className="cursor-pointer text-xs hover:text-foreground"
                        onClick={() => fetchDir(seg.path)}
                      >
                        {seg.label}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">{seg.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Toolbar */}
      <Toolbar
        selectedCount={selected.size}
        showHidden={showHidden}
        onNewFolder={() => setNewFolderOpen(true)}
        onUploadFiles={handleFiles}
        onDelete={() => handleDelete()}
        onRefresh={() => fetchDir(currentPath)}
        onToggleHidden={() => setShowHidden((v) => !v)}
        activeUploadCount={uploadMinimized ? uploads.filter((u) => u.status === "pending" || u.status === "uploading").length : undefined}
        onShowUploads={uploadMinimized ? () => setUploadMinimized(false) : undefined}
      />

      {/* File list */}
      <UploadZone onFiles={handleFiles}>
        <ScrollArea className="flex-1">
          {loading && (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-40 gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FolderOpen className="h-10 w-10" />
              <p className="text-sm">This folder is empty. Drop files here to upload.</p>
            </div>
          )}
          {!loading && !error && entries.length > 0 && (() => {
            const visible = showHidden
              ? entries
              : entries.filter((e) => !e.name.startsWith("."));
            return (
            <div className="w-full text-sm">
              {/* Header row */}
              <div className="flex items-center border-b bg-muted/30 text-xs text-muted-foreground px-3 py-2">
                <span className="flex-1 font-medium">Name</span>
                <span className="font-medium w-24 text-right hidden sm:block">Size</span>
                <span className="font-medium w-44 text-right hidden md:block">Modified</span>
              </div>
              {visible.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <FolderOpen className="h-10 w-10" />
                  <p className="text-sm">All items are hidden. Toggle "Show hidden files" to see them.</p>
                </div>
              )}
              {/* Entry rows */}
              {visible.map((entry) => (
                <ContextMenu key={entry.path}>
                  <ContextMenuTrigger
                    onContextMenu={() => {
                      if (!selected.has(entry.path)) {
                        setSelected(new Set([entry.path]));
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "flex items-center border-b border-border/50 cursor-pointer select-none transition-colors px-3 py-2",
                        "hover:bg-muted/40",
                        selected.has(entry.path) && "bg-primary/10 hover:bg-primary/15"
                      )}
                      onClick={(e) => {
                        if (entry.type === "directory") navigate(entry);
                        else toggleSelect(entry.path, e);
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileIcon
                          type={entry.type}
                          extension={entry.extension}
                          isOpen={false}
                        />
                        <span className="truncate">{entry.name}</span>
                      </div>
                      <span className="w-24 text-right text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                        {entry.type === "file" ? formatBytes(entry.size) : "—"}
                      </span>
                      <span className="w-44 text-right text-muted-foreground whitespace-nowrap shrink-0 hidden md:block">
                        {formatDate(entry.modified)}
                      </span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {entry.type === "directory" && (
                      <ContextMenuItem onClick={() => navigate(entry)}>
                        <FolderOpen className="h-4 w-4 mr-2" /> Open
                      </ContextMenuItem>
                    )}
                    {entry.type === "file" && (
                      <ContextMenuItem onClick={() => handleDownload(entry)}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem onClick={() => setRenaming(entry)}>
                      <Pencil className="h-4 w-4 mr-2" /> Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete([entry.path])}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
            );
          })()}
        </ScrollArea>
      </UploadZone>

      {/* Status bar */}
      <div className="px-4 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground flex items-center gap-3">
        <span>{entries.filter((e) => showHidden || !e.name.startsWith(".")).length} items</span>
        {!showHidden && entries.some((e) => e.name.startsWith(".")) && (
          <span className="text-muted-foreground/60">
            {entries.filter((e) => e.name.startsWith(".")).length} hidden
          </span>
        )}
        {selected.size > 0 && <span>{selected.size} selected</span>}
      </div>

      {/* Dialogs */}
      <RenameDialog
        open={!!renaming}
        current={renaming?.name ?? ""}
        onConfirm={handleRename}
        onCancel={() => setRenaming(null)}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onConfirm={handleNewFolder}
        onCancel={() => setNewFolderOpen(false)}
      />

      {/* Upload queue overlay */}
      <UploadQueue
        items={uploads}
        minimized={uploadMinimized}
        onDismiss={dismissUpload}
        onCancel={cancelUpload}
        onMinimize={() => setUploadMinimized(true)}
      />
    </div>
  );
}
