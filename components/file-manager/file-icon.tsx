"use client";

import {
  Folder, FolderOpen, FileVideo, FileAudio, FileImage,
  FileText, FileArchive, File, FileCode,
} from "lucide-react";

const VIDEO_EXTS = new Set(["mp4", "mkv", "avi", "mov", "wmv", "webm", "flv", "m4v", "ts"]);
const AUDIO_EXTS = new Set(["mp3", "flac", "aac", "ogg", "wav", "m4a", "opus"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "avif"]);
const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "bz2", "xz", "7z", "rar"]);
const CODE_EXTS = new Set(["ts", "tsx", "js", "jsx", "py", "go", "rs", "c", "cpp", "java", "json", "yaml", "yml", "toml", "sh"]);
const TEXT_EXTS = new Set(["txt", "md", "log", "csv", "xml", "html", "css"]);

interface FileIconProps {
  type: "file" | "directory";
  extension: string;
  isOpen?: boolean;
  className?: string;
}

export function FileIcon({ type, extension, isOpen, className = "h-4 w-4" }: FileIconProps) {
  if (type === "directory") {
    return isOpen
      ? <FolderOpen className={`${className} text-yellow-400`} />
      : <Folder className={`${className} text-yellow-400`} />;
  }

  const ext = extension.toLowerCase();

  if (VIDEO_EXTS.has(ext)) return <FileVideo className={`${className} text-purple-400`} />;
  if (AUDIO_EXTS.has(ext)) return <FileAudio className={`${className} text-pink-400`} />;
  if (IMAGE_EXTS.has(ext)) return <FileImage className={`${className} text-green-400`} />;
  if (ARCHIVE_EXTS.has(ext)) return <FileArchive className={`${className} text-orange-400`} />;
  if (CODE_EXTS.has(ext)) return <FileCode className={`${className} text-blue-400`} />;
  if (TEXT_EXTS.has(ext)) return <FileText className={`${className} text-gray-400`} />;
  return <File className={`${className} text-muted-foreground`} />;
}
