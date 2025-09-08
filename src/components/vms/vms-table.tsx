
"use client";

import React, { useState, useMemo } from "react";
import type { VirtualMachine } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateWaveDialog } from "@/components/waves/create-wave-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown } from "lucide-react";

type VmsTableProps = {
  vms: VirtualMachine[];
  isLoading: boolean;
};

type SortConfig = {
    key: keyof VirtualMachine | null;
    direction: 'ascending' | 'descending';
};

const powerStateOrder: { [key: string]: number } = { 'poweredOn': 1, 'suspended': 2, 'poweredOff': 3 };

export function VmsTable({ vms, isLoading }: VmsTableProps) {
  const [selectedVms, setSelectedVms] = useState<VirtualMachine[]>([]);
  const [isCreateWaveDialogOpen, setIsCreateWaveDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const sortedVms = useMemo(() => {
    let sortableVms = [...vms];
    if (sortConfig.key !== null) {
      sortableVms.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        // Handle N/A or nullish values
        if (aValue === 'N/A' || aValue === null) return 1;
        if (bValue === 'N/A' || bValue === null) return -1;
        
        let comparison = 0;

        // Custom sorting logic based on key
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
            case 'cpuUsage':
            case 'memoryUsage':
            case 'storageUsage':
                comparison = (aValue as number) - (bValue as number);
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


  const handleSelectVm = (vm: VirtualMachine, isSelected: boolean) => {
    setSelectedVms((prev) =>
      isSelected ? [...prev, vm] : prev.filter((v) => v.id !== vm.id)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedVms(isSelected ? sortedVms : []);
  };

  const isAllSelected = sortedVms.length > 0 && selectedVms.length === sortedVms.length;

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
    <>
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          disabled={selectedVms.length === 0}
          onClick={() => setIsCreateWaveDialogOpen(true)}
        >
          Create Wave ({selectedVms.length})
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  aria-label="Select all"
                  disabled={isLoading || vms.length === 0}
                />
              </TableHead>
              <SortableHeader sortKey="name">VM Name</SortableHeader>
              <SortableHeader sortKey="powerState">Power State</SortableHeader>
              <SortableHeader sortKey="ipAddress">IP Address</SortableHeader>
              <SortableHeader sortKey="hostname">Hostname</SortableHeader>
              <SortableHeader sortKey="cpuUsage">CPU (MHz)</SortableHeader>
              <SortableHeader sortKey="memoryUsage">Memory (MB)</SortableHeader>
              <SortableHeader sortKey="storageUsage">Storage (GB)</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    </TableRow>
                ))
            ) : sortedVms.length > 0 ? (
              sortedVms.map((vm) => (
                <TableRow key={vm.id} data-state={selectedVms.some(v => v.id === vm.id) && "selected"}>
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
                  <TableCell>{vm.cpuUsage.toLocaleString()}</TableCell>
                  <TableCell>{vm.memoryUsage.toLocaleString()}</TableCell>
                  <TableCell>{vm.storageUsage.toLocaleString()}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No virtual machines found for this host.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    <CreateWaveDialog 
        isOpen={isCreateWaveDialogOpen}
        onOpenChange={setIsCreateWaveDialogOpen}
        preselectedVms={selectedVms}
    />
    </>
  );
}
