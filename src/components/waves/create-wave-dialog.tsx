
"use client";

import { useState, useEffect, useMemo } from "react";
import type { Host, VirtualMachine } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

type CreateWaveDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVms?: VirtualMachine[];
};

const VMS_PER_PAGE = 5;

type SortConfig = {
    key: keyof VirtualMachine | null;
    direction: 'ascending' | 'descending';
};

const powerStateOrder: { [key: string]: number } = { 'poweredOn': 1, 'suspended': 2, 'poweredOff': 3 };


export function CreateWaveDialog({
  isOpen,
  onOpenChange,
  preselectedVms = []
}: CreateWaveDialogProps) {
  const { hosts, createWave, vms, isFetchingVms, fetchVmsForHost } = useAppContext();
  const [waveName, setWaveName] = useState("");
  const [selectedSourceHostId, setSelectedSourceHostId] = useState<string | null>(null);
  const [selectedVms, setSelectedVms] = useState<VirtualMachine[]>(preselectedVms);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const isPreselecting = preselectedVms.length > 0;

  const sortedVms = useMemo(() => {
    let sortableVms = [...vms];
    if (sortConfig.key !== null) {
      sortableVms.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === 'N/A' || aValue === null) return 1;
        if (bValue === 'N/A' || bValue === null) return -1;
        
        let comparison = 0;

        switch (sortConfig.key) {
            case 'powerState':
                comparison = (powerStateOrder[aValue] || 99) - (powerStateOrder[bValue] || 99);
                break;
            case 'ipAddress':
                const ipA = aValue.split('.').map(Number);
                const ipB = bValue.split('.').map(Number);
                for (let i = 0; i < 4; i++) {
                    if (ipA[i] !== ipB[i]) {
                        comparison = ipA[i] - ipB[i];
                        break;
                    }
                }
                break;
            default:
                comparison = (aValue as string).localeCompare(bValue as string);
                break;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableVms;
  }, [vms, sortConfig]);

  const requestSort = (key: keyof VirtualMachine) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedVms(preselectedVms);
    } else {
      setWaveName("");
      setSelectedSourceHostId(null);
      setSelectedVms([]);
      setCurrentPage(1);
      setSortConfig({ key: 'name', direction: 'ascending' });
    }
  }, [isOpen, preselectedVms]);

  useEffect(() => {
    if (selectedSourceHostId) {
       fetchVmsForHost(selectedSourceHostId);
    }
    if (!isPreselecting) {
        setSelectedVms([]);
    }
    setCurrentPage(1);
  }, [selectedSourceHostId, isPreselecting]);

  const paginatedVms = useMemo(() => {
    const startIndex = (currentPage - 1) * VMS_PER_PAGE;
    const endIndex = startIndex + VMS_PER_PAGE;
    return sortedVms.slice(startIndex, endIndex);
  }, [sortedVms, currentPage]);

  const totalPages = Math.ceil(sortedVms.length / VMS_PER_PAGE);

  const handleSelectVm = (vm: VirtualMachine, isSelected: boolean) => {
    setSelectedVms((prev) =>
      isSelected ? [...prev, vm] : prev.filter((v) => v.id !== vm.id)
    );
  };
  
  const handleSelectAllVms = (isSelected: boolean) => {
    setSelectedVms(isSelected ? [...sortedVms] : []);
  }

  const isAllVmsSelected = sortedVms.length > 0 && selectedVms.length === sortedVms.length;


  const handleSubmit = () => {
    if (waveName.trim()) {
      createWave(waveName.trim(), selectedVms, ""); // Passing empty string for targetHostId
      onOpenChange(false);
    }
  };
  
  const getSortIndicator = (key: keyof VirtualMachine) => {
    if (sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
    }
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  }

  const SortableHeader = ({ sortKey, children }: { sortKey: keyof VirtualMachine, children: React.ReactNode }) => (
    <TableHead onClick={() => requestSort(sortKey)}>
        <div className="flex items-center cursor-pointer">
            {children}
            {getSortIndicator(sortKey)}
        </div>
    </TableHead>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Migration Wave</DialogTitle>
          <DialogDescription>
            {isPreselecting
              ? `This wave will include ${preselectedVms.length} selected VM(s). Enter a name to create the wave.`
              : "Enter a wave name, select a source host, and VMs to include."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="waveName">Wave Name</Label>
                <Input
                    id="waveName"
                    value={waveName}
                    onChange={(e) => setWaveName(e.target.value)}
                    placeholder="e.g., Production DBs - Phase 1"
                />
            </div>
            {!isPreselecting && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="sourceHost">Source Host</Label>
                         <Select onValueChange={setSelectedSourceHostId} disabled={!waveName.trim()}>
                            <SelectTrigger id="sourceHost">
                                <SelectValue placeholder="Select a source host to see its VMs" />
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

                    {selectedSourceHostId && (
                        <div className="space-y-2">
                             <Label>Virtual Machines ({selectedVms.length} selected)</Label>
                            <div className="rounded-md border max-h-72 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                <Checkbox
                                                    checked={isAllVmsSelected}
                                                    onCheckedChange={(checked) => handleSelectAllVms(Boolean(checked))}
                                                    aria-label="Select all VMs"
                                                    disabled={isFetchingVms || vms.length === 0}
                                                />
                                            </TableHead>
                                            <SortableHeader sortKey="name">VM Name</SortableHeader>
                                            <SortableHeader sortKey="powerState">Power State</SortableHeader>
                                            <SortableHeader sortKey="ipAddress">IP Address</SortableHeader>
                                            <SortableHeader sortKey="hostname">Hostname</SortableHeader>
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
                                                <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
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
                                            <TableCell>{vm.hostname}</TableCell>
                                        </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                            No virtual machines found for this host.
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
                </>
            )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!waveName.trim() || selectedVms.length === 0}>
            Create Wave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
