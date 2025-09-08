
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/context/AppContext";
import { Skeleton } from "@/components/ui/skeleton";

const VMS_PER_PAGE = 5;

type AddVmsToWaveDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  wave: MigrationWave;
};

export function AddVmsToWaveDialog({
  isOpen,
  onOpenChange,
  wave,
}: AddVmsToWaveDialogProps) {
  const { hosts, vms, isFetchingVms, fetchVmsForHost, addVmsToWave } = useAppContext();
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [selectedVms, setSelectedVms] = useState<VirtualMachine[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Reset state when dialog opens/closes
    if (!isOpen) {
      setSelectedHostId(null);
      setSelectedVms([]);
      setCurrentPage(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedHostId) {
        fetchVmsForHost(selectedHostId);
    }
    setSelectedVms([]);
    setCurrentPage(1);
  }, [selectedHostId]);

  const availableVms = useMemo(() => {
    const vmsInWaveIds = new Set(wave.vms.map(vm => vm.id));
    return vms.filter(vm => !vmsInWaveIds.has(vm.id));
  }, [vms, wave.vms]);


  const paginatedVms = useMemo(() => {
    const startIndex = (currentPage - 1) * VMS_PER_PAGE;
    return availableVms.slice(startIndex, startIndex + VMS_PER_PAGE);
  }, [availableVms, currentPage]);

  const totalPages = Math.ceil(availableVms.length / VMS_PER_PAGE);

  const handleSelectVm = (vm: VirtualMachine, isSelected: boolean) => {
    setSelectedVms((prev) =>
      isSelected ? [...prev, vm] : prev.filter((v) => v.id !== vm.id)
    );
  };
  
  const handleSelectAllVms = (isSelected: boolean) => {
    setSelectedVms(isSelected ? [...availableVms] : []);
  }

  const isAllVmsSelected = availableVms.length > 0 && selectedVms.length === availableVms.length;

  const handleSubmit = () => {
    addVmsToWave(wave.id, selectedVms);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add VMs to Wave: {wave.name}</DialogTitle>
          <DialogDescription>
            Select a host to see available VMs that are not already in this wave.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                    <Select onValueChange={setSelectedHostId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a host to see its VMs" />
                    </SelectTrigger>
                    <SelectContent>
                        {hosts.map(host => (
                            <SelectItem key={host.id} value={host.id}>
                                {host.ipAddress}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedHostId && (
                <div className="space-y-2">
                        <Label>Available Virtual Machines ({selectedVms.length} selected)</Label>
                    <div className="rounded-md border max-h-72 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Checkbox
                                            checked={isAllVmsSelected}
                                            onCheckedChange={(checked) => handleSelectAllVms(Boolean(checked))}
                                            aria-label="Select all VMs"
                                            disabled={isFetchingVms || availableVms.length === 0}
                                        />
                                    </TableHead>
                                    <TableHead>VM Name</TableHead>
                                    <TableHead>Power State</TableHead>
                                    <TableHead>IP Address</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isFetchingVms ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : paginatedVms.length > 0 ? (
                                    paginatedVms.map((vm) => (
                                        <TableRow key={vm.id}>
                                            <TableCell>
                                                <Checkbox
                                                checked={selectedVms.some(v => v.id === vm.id)}
                                                onCheckedChange={(checked) => handleSelectVm(vm, Boolean(checked))}
                                                aria-label={`Select VM ${vm.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{vm.name}</TableCell>
                                            <TableCell>{vm.powerState}</TableCell>
                                            <TableCell>{vm.ipAddress}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No more VMs available to add from this host.
                                        </TableCell>
                                    </TableRow>
                                )}
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
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={selectedVms.length === 0}>
            Add Selected VMs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
