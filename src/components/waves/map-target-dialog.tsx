
"use client";

import { useState } from "react";
import type { VirtualMachine, Host } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/context/AppContext";

type MapTargetDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  waveId: string;
  selectedVms: VirtualMachine[];
};

export function MapTargetDialog({
  isOpen,
  onOpenChange,
  waveId,
  selectedVms,
}: MapTargetDialogProps) {
  const { vmeHosts, mapTargetToVms } = useAppContext();
  const [selectedTargetHostId, setSelectedTargetHostId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedTargetHostId) {
      const vmIds = selectedVms.map(vm => vm.id);
      mapTargetToVms(waveId, vmIds, selectedTargetHostId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Map Target Host</DialogTitle>
          <DialogDescription>
            Select a target VME host to map to the {selectedVms.length} selected VM(s).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="targetHost">Target VME Host</Label>
            <Select onValueChange={setSelectedTargetHostId} defaultValue={selectedTargetHostId ?? undefined}>
              <SelectTrigger id="targetHost">
                <SelectValue placeholder="Select a target host" />
              </SelectTrigger>
              <SelectContent>
                {vmeHosts.length > 0 ? (
                    vmeHosts.map((host) => (
                        <SelectItem key={host.id} value={host.id}>
                            {host.ipAddress}
                        </SelectItem>
                    ))
                ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                        No VME hosts added.
                    </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedTargetHostId}>
            Map Target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
