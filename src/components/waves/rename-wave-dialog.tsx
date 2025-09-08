
"use client";

import { useState, useEffect } from "react";
import type { MigrationWave } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/context/AppContext";

type RenameWaveDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  wave: MigrationWave;
};

export function RenameWaveDialog({
  isOpen,
  onOpenChange,
  wave,
}: RenameWaveDialogProps) {
  const { renameWave } = useAppContext();
  const [waveName, setWaveName] = useState(wave.name);

  useEffect(() => {
    if (isOpen) {
      setWaveName(wave.name);
    }
  }, [isOpen, wave.name]);

  const handleSubmit = () => {
    if (waveName.trim() && waveName.trim() !== wave.name) {
      renameWave(wave.id, waveName.trim());
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Wave</DialogTitle>
          <DialogDescription>
            Enter a new name for the wave &quot;{wave.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <div className="space-y-2">
                <Label htmlFor="waveName" className="text-right">
                Wave Name
                </Label>
                <Input
                    id="waveName"
                    value={waveName}
                    onChange={(e) => setWaveName(e.target.value)}
                    className="col-span-3"
                />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!waveName.trim() || waveName.trim() === wave.name}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
