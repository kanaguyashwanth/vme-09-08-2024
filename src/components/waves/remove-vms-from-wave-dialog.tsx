
"use client";

import { useState, useEffect, useMemo } from "react";
import type { MigrationWave, VirtualMachine } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/context/AppContext";

const VMS_PER_PAGE = 5;

type RemoveVmsFromWaveDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  wave: MigrationWave;
};

export function RemoveVmsFromWaveDialog({
  isOpen,
  onOpenChange,
  wave,
}: RemoveVmsFromWaveDialogProps) {
  const { removeVmsFromWave } = useAppContext();
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Reset state when dialog opens/closes
    if (!isOpen) {
      setSelectedVmIds([]);
      setCurrentPage(1);
    }
  }, [isOpen]);

  const paginatedVms = useMemo(() => {
    const startIndex = (currentPage - 1) * VMS_PER_PAGE;
    return wave.vms.slice(startIndex, startIndex + VMS_PER_PAGE);
  }, [wave.vms, currentPage]);

  const totalPages = Math.ceil(wave.vms.length / VMS_PER_PAGE);

  const handleSelectVm = (vmId: string, isSelected: boolean) => {
    setSelectedVmIds((prev) =>
      isSelected ? [...prev, vmId] : prev.filter((id) => id !== vmId)
    );
  };
  
  const handleSelectAllVms = (isSelected: boolean) => {
    setSelectedVmIds(isSelected ? wave.vms.map(vm => vm.id) : []);
  }

  const isAllVmsSelected = wave.vms.length > 0 && selectedVmIds.length === wave.vms.length;

  const handleSubmit = () => {
    removeVmsFromWave(wave.id, selectedVmIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Remove VMs from Wave: {wave.name}</DialogTitle>
          <DialogDescription>
            Select VMs to remove from this migration wave.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            {wave.vms.length > 0 ? (
                <div className="space-y-2">
                        <Label>Virtual Machines in Wave ({selectedVmIds.length} selected)</Label>
                    <div className="rounded-md border max-h-72 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Checkbox
                                            checked={isAllVmsSelected}
                                            onCheckedChange={(checked) => handleSelectAllVms(Boolean(checked))}
                                            aria-label="Select all VMs"
                                        />
                                    </TableHead>
                                    <TableHead>VM Name</TableHead>
                                    <TableHead>Power State</TableHead>
                                    <TableHead>IP Address</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedVms.map((vm) => (
                                <TableRow key={vm.id}>
                                    <TableCell>
                                        <Checkbox
                                        checked={selectedVmIds.includes(vm.id)}
                                        onCheckedChange={(checked) => handleSelectVm(vm.id, Boolean(checked))}
                                        aria-label={`Select VM ${vm.name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{vm.name}</TableCell>
                                    <TableCell>{vm.powerState}</TableCell>
                                    <TableCell>{vm.ipAddress}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-end space-x-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                        </div>
                    )}
                </div>
            ) : (
                 <p className="text-sm text-center text-muted-foreground pt-4">There are no VMs in this wave to remove.</p>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={selectedVmIds.length === 0} variant="destructive">
            Remove Selected VMs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
