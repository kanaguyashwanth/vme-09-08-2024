"use client";

import { useState, useCallback } from "react";
import type { MigrationWave, VirtualMachine } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

type IpReassignmentTableProps = {
  wave: MigrationWave;
};

export function IpReassignmentTable({ wave }: IpReassignmentTableProps) {
  const { reassignVmIp } = useAppContext();
  const { toast } = useToast();
  
  const [selectedVm, setSelectedVm] = useState<VirtualMachine | null>(null);
  const [targetIp, setTargetIp] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleIpReassignment = useCallback((vm: VirtualMachine) => {
    setSelectedVm(vm);
    setTargetIp(vm.ipAddress || "");
    setIsDialogOpen(true);
  }, []);

  const handleConfirmReassignment = useCallback(async () => {
    if (!selectedVm || !targetIp.trim()) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter a valid target IP address.", 
        variant: "destructive" 
      });
      return;
    }

    // Simple IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(targetIp.trim())) {
      toast({ 
        title: "Invalid IP Address", 
        description: "Please enter a valid IP address format (e.g., 192.168.1.100).", 
        variant: "destructive" 
      });
      return;
    }

    await reassignVmIp(wave.id, selectedVm.id, targetIp.trim());
    setIsDialogOpen(false);
    setSelectedVm(null);
    setTargetIp("");
  }, [selectedVm, targetIp, wave.id, reassignVmIp, toast]);

  const getStatusIcon = (status?: VirtualMachine['ipReassignmentStatus']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = (vm: VirtualMachine) => {
    const status = vm.ipReassignmentStatus;
    switch (status) {
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      case 'running':
        return vm.ipReassignmentLogs || 'In Progress';
      default:
        return 'Pending';
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VM Name</TableHead>
            <TableHead>Source VM IP</TableHead>
            <TableHead>Target VM IP</TableHead>
            <TableHead>Guest OS</TableHead>
            <TableHead className="w-80">Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wave.vms.map(vm => (
            <TableRow key={vm.id}>
              <TableCell className="font-medium">{vm.name}</TableCell>
              <TableCell>{vm.ipAddress || 'N/A'}</TableCell>
              <TableCell>{vm.liveSyncTargetIp || 'N/A'}</TableCell>
              <TableCell>{vm.guestOs || vm.osType || 'N/A'}</TableCell>
              <TableCell className="max-w-xs">
                <div className="flex items-start gap-2">
                  {getStatusIcon(vm.ipReassignmentStatus)}
                  <div className="text-sm">
                    {vm.ipReassignmentStatus === 'running' && vm.ipReassignmentLogs ? (
                      <div className="space-y-1">
                        <div className="font-medium text-blue-600">In Progress</div>
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {vm.ipReassignmentLogs}
                        </div>
                      </div>
                    ) : (
                      <span>{getStatusText(vm)}</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleIpReassignment(vm)}
                  disabled={
                    !vm.liveSyncTargetIp || 
                    !vm.liveSyncUsername || 
                    !vm.liveSyncPassword || 
                    (vm.osType !== 'Windows' && vm.osType !== 'Linux')
                  }
                >
                  {(vm.osType !== 'Windows' && vm.osType !== 'Linux') ? 'Not Supported' : 'Change IP'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>IP Address Reassignment</DialogTitle>
            <DialogDescription>
              Change the IP address for {selectedVm?.name} ({selectedVm?.osType}). This will connect to the target VM via SSH and update its network configuration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="currentIp" className="text-right font-medium">
                Current IP:
              </label>
              <div className="col-span-3 px-3 py-2 bg-muted rounded-md">
                {selectedVm?.liveSyncTargetIp || 'N/A'}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="targetIp" className="text-right font-medium">
                New IP:
              </label>
              <Input
                id="targetIp"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="192.168.1.100"
                className="col-span-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReassignment}>
              Change IP Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
