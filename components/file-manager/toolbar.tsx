"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FolderPlus, Upload, FolderUp, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";

interface ToolbarProps {
  selectedCount: number;
  showHidden: boolean;
  onNewFolder: () => void;
  onUploadFiles: (files: { file: File; relativePath: string }[]) => void;
  onDelete: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
}

export function Toolbar({
  selectedCount,
  showHidden,
  onNewFolder,
  onUploadFiles,
  onDelete,
  onRefresh,
  onToggleHidden,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files;
    if (!raw) return;
    const files = Array.from(raw).map((f) => ({ file: f, relativePath: f.name }));
    onUploadFiles(files);
    e.target.value = "";
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files;
    if (!raw) return;
    const files = Array.from(raw).map((f) => ({
      file: f,
      relativePath: (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name,
    }));
    onUploadFiles(files);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30">
      <Button variant="ghost" size="sm" onClick={onNewFolder}>
        <FolderPlus className="h-4 w-4 mr-1.5" />
        New Folder
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload className="h-4 w-4 mr-1.5" />
        Upload Files
      </Button>

      <Button variant="ghost" size="sm" onClick={() => folderInputRef.current?.click()}>
        <FolderUp className="h-4 w-4 mr-1.5" />
        Upload Folder
      </Button>

      {/* Hidden file inputs */}
      <Input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <Input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error – webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      <div className="flex-1" />

      {selectedCount > 0 && (
        <>
          <span className="text-xs text-muted-foreground mr-2">
            {selectedCount} selected
          </span>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </>
      )}

      <Tooltip>
        <TooltipTrigger
          className={`inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors ${showHidden ? "text-primary" : "text-muted-foreground"}`}
          onClick={onToggleHidden}
        >
          {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </TooltipTrigger>
        <TooltipContent>{showHidden ? "Hide hidden files" : "Show hidden files"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
    </div>
  );
}
