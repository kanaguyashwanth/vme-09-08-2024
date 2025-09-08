
"use client";

import { useState, useEffect } from "react";
import type { VirtualMachine } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "../ui/label";
import { Loader2 } from "lucide-react";

type FileDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vm: VirtualMachine;
  waveId: string;
  checkFilesForVm: (waveId: string, vmId: string) => Promise<void>;
};

export function FileDetailsDialog({ isOpen, onOpenChange, vm, waveId, checkFilesForVm }: FileDetailsDialogProps) {
  
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckFiles = async () => {
    setIsLoading(true);
    await checkFilesForVm(waveId, vm.id);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) {
        setIsLoading(false);
    }
  }, [isOpen]);

  const sourceFileContent = () => {
    if (isLoading) return <p className="text-sm text-muted-foreground">Checking...</p>;
    if (typeof vm.sourceFileCount === 'number') {
        return <p className="text-2xl font-bold">{vm.sourceFileCount.toLocaleString()}</p>;
    }
    return <p className="text-sm text-muted-foreground">Click "Check Files" to populate.</p>;
  }

  const targetFileContent = () => {
    if (isLoading) return <p className="text-sm text-muted-foreground">Checking...</p>;
     if (typeof vm.targetFileCount === 'number') {
        return <p className="text-2xl font-bold">{vm.targetFileCount.toLocaleString()}</p>;
    }
    return <p className="text-sm text-muted-foreground">Click "Check Files" to populate.</p>;
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>File Details: {vm.name}</DialogTitle>
          <DialogDescription>
            Compare file counts between source ({vm.ipAddress}) and target ({vm.liveSyncTargetIp || 'N/A'}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
                <Label>Source Files</Label>
                <div className="h-40 w-full rounded-md border p-4 flex items-center justify-center">
                    {sourceFileContent()}
                </div>
            </div>
            <div className="space-y-2">
                 <Label>Target Files</Label>
                <div className="h-40 w-full rounded-md border p-4 flex items-center justify-center">
                   {targetFileContent()}
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCheckFiles} disabled={isLoading || !vm.liveSyncTargetIp}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Checking..." : "Check Files"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
