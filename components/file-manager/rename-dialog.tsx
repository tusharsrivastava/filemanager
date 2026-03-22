"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RenameDialogProps {
  open: boolean;
  current: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ open, current, onConfirm, onCancel }: RenameDialogProps) {
  const [value, setValue] = useState(current);

  useEffect(() => { setValue(current); }, [current]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== current) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          autoFocus
          className="mt-2"
        />
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={!value.trim()}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
