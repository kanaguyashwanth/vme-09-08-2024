
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
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

type ChkdskReportDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vm: VirtualMachine;
  waveId: string;
  checkFilesForVm: (waveId: string, vmId: string) => Promise<void>;
};

export function ChkdskReportDialog({ isOpen, onOpenChange, vm, waveId, checkFilesForVm }: ChkdskReportDialogProps) {
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

  const renderReport = (report: Record<string, string> | undefined) => {
    if (!report || Object.keys(report).length === 0) {
      return (
        <div className="text-center text-sm text-muted-foreground h-40 flex items-center justify-center">
          <p>No report available. Click "Check Files" to generate one.</p>
        </div>
      );
    }

    if (report.error) {
        return (
            <div className="text-center text-sm text-destructive h-40 flex items-center justify-center">
                <p>{report.error}</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-40">
           <div className="space-y-2 p-4 font-mono text-sm">
            {Object.entries(report).map(([drive, summary]) => (
                <div key={drive} className="flex justify-between">
                    <span className="font-semibold">Drive {drive}:</span>
                    <span>{summary}</span>
                </div>
            ))}
            </div>
        </ScrollArea>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>File Details: {vm.name}</DialogTitle>
          <DialogDescription>
            Disk health summary for source ({vm.ipAddress}) and target ({vm.liveSyncTargetIp || 'N/A'}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div>
                <Label className="font-semibold">Source Report</Label>
                {isLoading ? (
                    <div className="flex items-center justify-center h-48 border rounded-md mt-2">
                        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                        <p>Checking Source...</p>
                    </div>
                ) : (
                    <div className="mt-2 border rounded-md">
                        {renderReport(vm.sourceChkdskReport)}
                    </div>
                )}
            </div>
             <div>
                <Label className="font-semibold">Target Report</Label>
                {isLoading ? (
                    <div className="flex items-center justify-center h-48 border rounded-md mt-2">
                        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                        <p>Checking Target...</p>
                    </div>
                ) : (
                    <div className="mt-2 border rounded-md">
                        {renderReport(vm.targetChkdskReport)}
                    </div>
                )}
            </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCheckFiles} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Checking..." : "Check Files"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
