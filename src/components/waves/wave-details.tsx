

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { MigrationWave, VirtualMachine, Stage, StageStatus } from "@/types";
import { format } from "date-fns";
import { CheckCircle, XCircle, ChevronDown, Loader2, PlayCircle, StopCircle, CircleDot, HelpCircle, PowerOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { MapTargetDialog } from "@/components/waves/map-target-dialog";
import { LiveSyncDialog } from "@/components/waves/live-sync-dialog";
import { WindowsLiveSyncDialog } from "@/components/waves/windows-live-sync-dialog";
import { FileDetailsDialog } from "@/components/waves/file-details-dialog";
import { ChkdskReportDialog } from "@/components/waves/chkdsk-report-dialog";
import { IpReassignmentTable } from "@/components/waves/ip-reassignment-table";


type WaveDetailsProps = {
  wave: MigrationWave;
};

// Helper function to prevent rendering non-primitive values
const safeRender = (value: any): string | number => {
    if (typeof value === 'string' || typeof value === 'number') {
        return value;
    }
    return '';
};

export function WaveDetails({ wave }: WaveDetailsProps) {
  const { 
    generatePreCheckReport, 
    initiateCloning, 
    prepareCloneForTarget, 
    createTargetVm, 
    checkMigrationProgress,
    checkVmStatusForWave,
    updateWaveStage,
    installMorpheusAgent,
    performPingTest,
    checkFilesForVm,
    shutdownSourceVm,
  } = useAppContext();

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { toast } = useToast();
  
  const [selectedVms, setSelectedVms] = useState<VirtualMachine[]>([]);
  const [isMapTargetDialogOpen, setIsMapTargetDialogOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [viewingLogsForVm, setViewingLogsForVm] = useState<VirtualMachine | null>(null);
  
  const [liveSyncVm, setLiveSyncVm] = useState<VirtualMachine | null>(null);
  const [isLinuxLiveSyncDialogOpen, setIsLinuxLiveSyncDialogOpen] = useState(false);
  const [isWindowsLiveSyncDialogOpen, setIsWindowsLiveSyncDialogOpen] = useState(false);
  const [fileDetailsVm, setFileDetailsVm] = useState<VirtualMachine | null>(null);
  const [chkdskVm, setChkdskVm] = useState<VirtualMachine | null>(null);

  const [isCheckingVmStatus, setIsCheckingVmStatus] = useState(false);
  const [showReplicationVms, setShowReplicationVms] = useState(false);
  const [isInstallingAgent, setIsInstallingAgent] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [showDeltaSyncDetails, setShowDeltaSyncDetails] = useState(false);
  const [showShutdownDetails, setShowShutdownDetails] = useState(false);
  const [showIpReassignmentDetails, setShowIpReassignmentDetails] = useState(false);

  const pollVmsRef = useRef<VirtualMachine[]>([]);

  const stages = useMemo(() => wave.stages || [], [wave.stages]);

  useEffect(() => {
    pollVmsRef.current = wave.vms.filter(vm => 
        vm.cloneStatus === 'running' || 
        vm.preparationStatus === 'running' ||
        vm.migrationStatus === 'running'
    );
  }, [wave.vms]);
  
  useEffect(() => {
    const poll = () => {
        if (pollVmsRef.current.length > 0) {
            pollVmsRef.current.forEach(vm => checkMigrationProgress(wave.id, vm.id));
        }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [wave.id, checkMigrationProgress]);
  

  useEffect(() => {
    // Reset component state when the wave itself changes
    setSelectedVms([]);
    setIsCloning(false);
    setShowReplicationVms(false);
    setShowDeltaSyncDetails(false);
    setShowShutdownDetails(false);
    setShowIpReassignmentDetails(false);
  }, [wave.id]);

  const handleSelectVm = (vm: VirtualMachine, isSelected: boolean) => {
    setSelectedVms((prev) =>
      isSelected ? [...prev, vm] : prev.filter((v) => v.id !== vm.id)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedVms(isSelected ? wave.vms : []);
  };

  const isAllSelected = wave.vms.length > 0 && selectedVms.length === wave.vms.length;

  const handlePerformPreCheck = async () => {
    setIsGeneratingReport(true);
    updateWaveStage(wave.id, 'Pre-Check', 'running');
    toast({ title: "Generating Report", description: "Please wait while the pre-check report is being generated..." });
    await generatePreCheckReport(wave);
    setIsGeneratingReport(false);
  };
  
  const handleMigrationPreparation = async () => {
    if (wave.vms.length === 0) {
      toast({ title: "No VMs in Wave", description: "There are no VMs in this wave to prepare for migration.", variant: "destructive" });
      return;
    }
  
    setIsCloning(true);
    updateWaveStage(wave.id, 'Migration Preparation', 'running');
  
    const vmIdsToProcess = wave.vms.map(vm => vm.id);
  
    for (const vmId of vmIdsToProcess) {
        toast({ title: `Starting process for VM`, description: `Initiating cloning for VM ID: ${vmId}.` });
        await initiateCloning(wave.id, [vmId]);
    }
    
    setIsCloning(false);
    toast({ title: `All cloning tasks initiated`, description: `Cloning has been started for all applicable VMs in the wave.` });
  };
  

  const handleCheckVmStatus = async () => {
      setIsCheckingVmStatus(true);
      updateWaveStage(wave.id, 'Replication', 'running');
      await checkVmStatusForWave(wave.id);
      setShowReplicationVms(true);
      setIsCheckingVmStatus(false);
  }

  const handleInstallAgent = async () => {
    setIsInstallingAgent(true);
    await installMorpheusAgent(wave.id);
    setIsInstallingAgent(false);
  };

  const handlePingTest = async () => {
    setIsPinging(true);
    await performPingTest(wave.id);
    setIsPinging(false);
  };

  const handleDeltaSync = () => {
    setShowDeltaSyncDetails(true);
    toast({ title: "Delta Sync", description: "Displaying VM details for file checking." });
  }

  const handleShowShutdownVmDetails = () => {
    setShowShutdownDetails(true);
    toast({ title: "Shutdown Source VMs", description: "Displaying VM details for shutdown." });
  }

  const handleShowIpReassignmentDetails = () => {
    setShowIpReassignmentDetails(true);
    toast({ title: "IP Re-Assignment", description: "Displaying VM details for IP reassignment." });
  }

  const handleShutdownVm = async (vmId: string) => {
    await shutdownSourceVm(wave.id, vmId);
  }
  
  const stageActions: { [key: string]: () => void } = {
    "Pre-Check": handlePerformPreCheck,
    "Migration Preparation": handleMigrationPreparation,
    "Replication": handleCheckVmStatus,
  };

  const handleCreateVmInstance = async (vmId: string) => {
    await prepareCloneForTarget(wave.id, vmId);
  }

  const handleTargetVMCreation = async (vmId: string) => {
    await createTargetVm(wave.id, vmId);
  };

  const handleStartLiveSync = (vm: VirtualMachine) => {
    setLiveSyncVm(vm);
    if(vm.osType === 'Windows') {
        setIsWindowsLiveSyncDialogOpen(true);
    } else {
        setIsLinuxLiveSyncDialogOpen(true);
    }
  };
  
  const handleOpenDetailsDialog = (vm: VirtualMachine) => {
    if (vm.osType === 'Windows') {
      setChkdskVm(vm);
    } else {
      setFileDetailsVm(vm);
    }
  };

  const getLiveSyncStatusText = (status: VirtualMachine['liveSyncStatus']) => {
    switch (status) {
        case 'syncing':
            return <span className="flex items-center text-blue-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sync in progress</span>;
        case 'ready':
        case 'error':
             return <span className="flex items-center text-red-600"><StopCircle className="mr-2 h-4 w-4" />Sync stopped</span>;
        default:
            return <span className="flex items-center text-muted-foreground">Sync not started yet</span>;
    }
  };


  const StatusIcon = ({ status }: { status: StageStatus }) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-8 w-8 text-green-500 bg-white rounded-full" />;
      case "failure":
        return <XCircle className="h-8 w-8 text-red-500 bg-white rounded-full" />;
      case "running":
        return <Loader2 className="h-8 w-8 text-blue-500 bg-white rounded-full animate-spin" />;
      default:
        return <div className="h-8 w-8 rounded-full border-2 border-muted-foreground bg-white flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-muted-foreground"></div></div>;
    }
  };

  const getLastLogLine = (logs?: any): string => {
    if (typeof logs !== 'string' || !logs.trim()) {
        return "";
    }
    const lines = logs.trim().split('\n');
    return lines[lines.length - 1] || "";
  };
  
  const replicationStageContent = useMemo(() => {
    const stage = stages.find(s => s.name === 'Replication');
    if (!stage || stage.status === 'pending' || !showReplicationVms) {
        return <p className="text-sm text-muted-foreground">Click "Perform" to check VM status and proceed.</p>;
    }
    
    return (
        <div className="space-y-4">
          {wave.vms.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>VM Name</TableHead>
                        <TableHead>Source VM IP</TableHead>
                        <TableHead>Target VM IP</TableHead>
                        <TableHead>Guest OS</TableHead>
                        <TableHead>VM Status</TableHead>
                        <TableHead>Live Sync Status</TableHead>
                        <TableHead>Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {wave.vms.map(vm => (
                        <TableRow key={vm.id}>
                            <TableCell>{vm.name}</TableCell>
                            <TableCell>{vm.ipAddress}</TableCell>
                            <TableCell>{vm.liveSyncTargetIp || 'Not Set'}</TableCell>
                            <TableCell>{vm.osType}</TableCell>
                            <TableCell>{vm.powerState}</TableCell>
                            <TableCell>{getLiveSyncStatusText(vm.liveSyncStatus)}</TableCell>
                            <TableCell>
                                <Button variant="secondary" size="sm" onClick={() => handleStartLiveSync(vm)} disabled={vm.powerState !== 'poweredOn'}>
                                    Manage Sync
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center">No VMs in this wave to replicate.</p>
          )}
        </div>
    );
  }, [stages, wave.vms, showReplicationVms]);
  
  const renderMigrationPreparationContent = () => {
    return wave.vms.map(vm => (
        <div key={vm.id} className="text-sm space-y-2">
            <div>
                <span className="font-medium">{vm.name}:</span>
                {!vm.cloneTaskId ? (
                    <span className="ml-2 text-muted-foreground">Waiting to start...</span>
                ) : (
                    <>
                        {vm.cloneStatus === 'running' && (
                            <>
                                <span className="ml-2">Cloning in progress...</span>
                                <div className="flex items-center gap-2 mt-1">
                                <Progress value={typeof vm.cloneProgress === 'number' ? vm.cloneProgress : 0} className="h-2 w-full" />
                                <span className="text-muted-foreground text-xs">{safeRender(vm.cloneProgress)}%</span>
                                </div>
                            </>
                        )}
                        {vm.cloneStatus === 'error' && <span className="ml-2 text-destructive font-medium">Cloning failed.</span>}
                        {vm.cloneStatus === 'success' && (
                            <div className="mt-1">
                                {vm.preparationStatus === 'running' ? (
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{safeRender(vm.cloneName)}:</span>
                                        <span className="font-mono text-xs">{getLastLogLine(vm.preparationLogs)}</span>
                                    </div>
                                ) : vm.preparationStatus === 'success' ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{safeRender(vm.cloneName)}:</span>
                                        <span className="font-normal text-green-600">Virtual machine is ready for migration.</span>
                                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setViewingLogsForVm(vm)}>View Logs</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleTargetVMCreation(vm.id)} disabled={!vm.targetName || vm.migrationStatus === 'running'}>
                                        {vm.migrationStatus === 'running' ? 'Migrating...' : 'Setup Target VM'}
                                        </Button>
                                    </div>
                                ) : vm.preparationStatus === 'error' ? (
                                    <div className="flex items-center gap-2">
                                    <span className="font-medium">{safeRender(vm.cloneName)}:</span>
                                    <span className="font-mono text-xs text-destructive">{getLastLogLine(vm.preparationLogs)}</span>
                                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setViewingLogsForVm(vm)}>View Logs</Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium">{vm.name}:</span>
                                      <span className="font-normal">Instance already present on source.</span>
                                      <Button size="sm" variant="outline" onClick={() => handleCreateVmInstance(vm.id)}>Create VM instance on target</Button>
                                    </div>
                                )}
                            </div>
                        )}
                        {vm.migrationStatus && (
                            <div>
                                <span className="font-medium">{safeRender(vm.cloneName)}:</span>
                                <span className="ml-2 font-mono text-xs">
                                    {vm.migrationStatus === 'running' ? vm.migrationLogs : 'Migration finished.'}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    ));
  };
  
  const getAgentStatusIcon = (status: VirtualMachine['morpheusAgentStatus']) => {
    switch(status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return <CircleDot className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const renderInstallAgentContent = () => {
    const isAnyVmPending = wave.vms.some(vm => !vm.morpheusAgentStatus || vm.morpheusAgentStatus === 'pending');
    
    if (isAnyVmPending && !isInstallingAgent) {
        return <p className="text-sm text-muted-foreground">Click "Perform" to begin agent installation on all applicable VMs.</p>;
    }

    return (
        <div className="space-y-2">
          {wave.vms.map(vm => (
            <div key={vm.id} className="flex items-center gap-2 text-sm">
                {getAgentStatusIcon(vm.morpheusAgentStatus)}
                <span className="font-medium">{vm.name}:</span>
                <span className="text-muted-foreground">{vm.morpheusAgentStatus || 'Pending'}</span>
            </div>
          ))}
        </div>
    );
  };

  const getPingStatusIcon = (status: VirtualMachine['pingStatus']) => {
    switch(status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const renderPingTestContent = () => {
    const isAnyVmTested = wave.vms.some(vm => vm.pingStatus);
    if (!isAnyVmTested && !isPinging) {
        return <p className="text-sm text-muted-foreground">Click "Perform" to run a ping test against all VM hostnames.</p>;
    }
    return (
      <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>VM Name</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Status</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {wave.vms.map(vm => (
                  <TableRow key={vm.id}>
                      <TableCell>{vm.name}</TableCell>
                      <TableCell>{vm.hostname}</TableCell>
                      <TableCell>
                          <div className="flex items-center gap-2">
                            {getPingStatusIcon(vm.pingStatus)}
                            <span className="capitalize">{vm.pingStatus || 'Not Tested'}</span>
                          </div>
                      </TableCell>
                  </TableRow>
              ))}
          </TableBody>
      </Table>
    )
  }

  const renderDeltaSyncContent = () => {
    if (!showDeltaSyncDetails) {
      return <p className="text-sm text-muted-foreground">Click "Perform" to check VM status and proceed.</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VM Name</TableHead>
            <TableHead>Source VM IP</TableHead>
            <TableHead>Target VM IP</TableHead>
            <TableHead>Guest OS</TableHead>
            <TableHead>File Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wave.vms.map(vm => (
            <TableRow key={vm.id}>
              <TableCell>{vm.name}</TableCell>
              <TableCell>{vm.ipAddress}</TableCell>
              <TableCell>{vm.liveSyncTargetIp || 'Not Set'}</TableCell>
              <TableCell>{vm.osType}</TableCell>
              <TableCell>
                 <Button variant="secondary" size="sm" onClick={() => handleOpenDetailsDialog(vm)}>
                    Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const getShutdownStatus = (vm: VirtualMachine) => {
    if (vm.shutdownStatus === 'shutting-down') {
        return <span className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Shutting down...</span>
    }
    if (vm.shutdownStatus === 'success' || vm.powerState === 'poweredOff') {
      return <span className="flex items-center text-green-600"><CheckCircle className="mr-2 h-4 w-4" />Powered Off</span>;
    }
    if (vm.shutdownStatus === 'error') {
        return <span className="flex items-center text-red-600"><XCircle className="mr-2 h-4 w-4" />Error</span>;
    }
    return vm.powerState;
  }
  
  const renderShutdownContent = () => {
    if (!showShutdownDetails) {
      return <p className="text-sm text-muted-foreground">Click "Perform" to view VMs and initiate shutdown.</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VM Name</TableHead>
            <TableHead>Source VM IP</TableHead>
            <TableHead>Guest OS</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wave.vms.map(vm => (
            <TableRow key={vm.id}>
              <TableCell>{vm.name}</TableCell>
              <TableCell>{vm.ipAddress}</TableCell>
              <TableCell>{vm.guestOs}</TableCell>
              <TableCell>{getShutdownStatus(vm)}</TableCell>
              <TableCell>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleShutdownVm(vm.id)}
                  disabled={vm.powerState !== 'poweredOn' || vm.shutdownStatus === 'shutting-down'}
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  Shutdown
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderIpReassignmentContent = () => {
    if (!showIpReassignmentDetails) {
      return <p className="text-sm text-muted-foreground">Click "Perform" to view VMs and manage IP reassignment.</p>;
    }
    return <IpReassignmentTable wave={wave} />;
  };
  
  const cutoverStages = [
    { name: "Ping Test", content: renderPingTestContent(), action: handlePingTest, isLoading: isPinging, loadingText: "Pinging..." },
    { name: "Delta Sync", content: renderDeltaSyncContent(), action: handleDeltaSync, isLoading: false, loadingText: "" },
    { name: "Shutdown Source VMs", content: renderShutdownContent(), action: handleShowShutdownVmDetails, isLoading: false, loadingText: "" },
  ];

  const postMigrationStages = [
    { name: "Install Morpheus Agent", content: renderInstallAgentContent(), action: handleInstallAgent, isLoading: isInstallingAgent, loadingText: "Installing..." },
    { name: "Remove VMWare Tools", content: <p className="text-sm text-muted-foreground">Click "Perform" to proceed.</p>, action: () => {}, isLoading: false, loadingText: "" },
    { name: "IP Re-Assignment", content: renderIpReassignmentContent(), action: handleShowIpReassignmentDetails, isLoading: false, loadingText: "" },
    { name: "Reboot Target VMs", content: <p className="text-sm text-muted-foreground">Click "Perform" to proceed.</p>, action: () => {}, isLoading: false, loadingText: "" },
  ];


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Wave Details: {wave.name}</CardTitle>
          <CardDescription>
            Created on {format(wave.createdAt, "PPP p")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Wave Details</TabsTrigger>
              <TabsTrigger value="pre-migration">Pre-Migration</TabsTrigger>
              <TabsTrigger value="migration-cutover">Migration Cutover</TabsTrigger>
              <TabsTrigger value="post-migration">Post-Migration</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <Card className="mt-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                      <div>
                          <CardTitle>Servers</CardTitle>
                          <CardDescription>
                            The following Servers are included in this wave.
                          </CardDescription>
                      </div>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button disabled={selectedVms.length === 0}>
                                  Actions ({selectedVms.length})
                                  <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setIsMapTargetDialogOpen(true)}>Map Target</DropdownMenuItem>
                              <DropdownMenuItem disabled>Re-Assign IP Address</DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                                  checked={isAllSelected}
                                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                  aria-label="Select all"
                                  disabled={wave.vms.length === 0}
                              />
                          </TableHead>
                          <TableHead>VM Name</TableHead>
                          <TableHead>Power State</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Hostname</TableHead>
                          <TableHead>Guest OS</TableHead>
                          <TableHead>Target</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wave.vms.length > 0 ? (
                          wave.vms.map((vm) => (
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
                              <TableCell>{vm.guestOs || 'N/A'}</TableCell>
                              <TableCell>{vm.targetName || "N/A"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              No VMs in this wave.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="pre-migration">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Pre-Migration</CardTitle>
                  <CardDescription>
                   Status of tasks to be performed for all VMs in the wave before migration cutover.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="relative pl-2">
                      {stages.map((stage, index) => (
                          <div key={stage.name} className="flex items-start">
                              <div className="flex flex-col items-center mr-4 self-stretch">
                                  <StatusIcon status={stage.status} />
                                  {index < stages.length - 1 && (
                                      <div className="w-px flex-grow bg-muted-foreground/50" />
                                  )}
                              </div>
                              <div className="pt-1 flex-grow pb-8">
                                  <div className="flex items-center">
                                      <p className={cn("font-medium w-48", stage.status === 'pending' && 'text-muted-foreground')}>
                                          {stage.name}
                                      </p>
                                      <Button 
                                        size="sm" 
                                        onClick={stageActions[stage.name]}
                                      >
                                        {isGeneratingReport && stage.name === 'Pre-Check' ? 'Generating...' : 
                                         isCloning && stage.name === 'Migration Preparation' ? 'Cloning...' : 
                                         isCheckingVmStatus && stage.name === 'Replication' ? 'Checking...' :
                                         'Perform'}
                                      </Button>
                                  </div>
                                  <div className="mt-4 mr-4 p-4 rounded-lg border bg-muted/50 space-y-4">
                                      {stage.name === "Replication" ? (
                                          replicationStageContent
                                      ) : stage.name === 'Migration Preparation' && stage.status !== 'pending' ? (
                                        renderMigrationPreparationContent()
                                      ) : stage.status !== 'pending' ? (
                                          stage.content
                                      ) : (
                                          <p className="text-sm text-muted-foreground">Click "Perform" to proceed.</p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="migration-cutover">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Migration Cutover</CardTitle>
                  <CardDescription>
                    Tasks related to the final migration cutover.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                <div className="relative pl-2">
                    {cutoverStages.map(({ name, content, action, isLoading, loadingText }, index, arr) => (
                        <div key={name} className="flex items-start">
                             <div className="flex flex-col items-center mr-4 self-stretch">
                                <StatusIcon status={"pending"} />
                                {index < arr.length - 1 && (
                                    <div className="w-px flex-grow bg-muted-foreground/50" />
                                )}
                            </div>
                            <div className="pt-1 flex-grow pb-8">
                                <div className="flex items-center">
                                    <p className="font-medium w-48 text-muted-foreground">{name}</p>
                                    <Button size="sm" onClick={action} disabled={isLoading}>
                                        {isLoading ? loadingText : 'Perform'}
                                    </Button>
                                </div>
                                <div className="mt-4 mr-4 p-4 rounded-lg border bg-muted/50">
                                    {content}
                                </div>
                            </div>
                        </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="post-migration">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Post-Migration</CardTitle>
                  <CardDescription>
                    Tasks to be performed after the migration is complete.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                   <div className="relative pl-2">
                    {postMigrationStages.map(({ name, content, action, isLoading, loadingText }, index, arr) => {
                        
                        let overallStatus: StageStatus = 'pending';
                        if (name === 'Install Morpheus Agent') {
                          if (isInstallingAgent) {
                            overallStatus = 'running';
                          } else if (wave.vms.every(vm => vm.morpheusAgentStatus === 'success')) {
                            overallStatus = 'success';
                          } else if (wave.vms.some(vm => vm.morpheusAgentStatus === 'failed')) {
                            overallStatus = 'failure';
                          } else if (wave.vms.some(vm => vm.morpheusAgentStatus === 'running')) {
                             overallStatus = 'running';
                          } else if (wave.vms.every(vm => !vm.morpheusAgentStatus || vm.morpheusAgentStatus === 'pending')) {
                            overallStatus = 'pending';
                          }
                        }

                        return (
                            <div key={name} className="flex items-start">
                                <div className="flex flex-col items-center mr-4 self-stretch">
                                    <StatusIcon status={overallStatus} />
                                    {index < arr.length - 1 && (
                                        <div className="w-px flex-grow bg-muted-foreground/50" />
                                    )}
                                </div>
                                <div className="pt-1 flex-grow pb-8">
                                    <div className="flex items-center">
                                        <p className="font-medium w-48 text-muted-foreground">{name}</p>
                                        <Button size="sm" onClick={action} disabled={isLoading}>
                                            {isLoading ? loadingText : 'Perform'}
                                        </Button>
                                    </div>
                                    <div className="mt-4 mr-4 p-4 rounded-lg border bg-muted/50">
                                        {content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {isMapTargetDialogOpen && (
          <MapTargetDialog
            isOpen={isMapTargetDialogOpen}
            onOpenChange={setIsMapTargetDialogOpen}
            waveId={wave.id}
            selectedVms={selectedVms}
          />
      )}
      {liveSyncVm && isLinuxLiveSyncDialogOpen && (
        <LiveSyncDialog
          isOpen={isLinuxLiveSyncDialogOpen}
          onOpenChange={setIsLinuxLiveSyncDialogOpen}
          vm={liveSyncVm}
          waveId={wave.id}
        />
      )}
      {liveSyncVm && isWindowsLiveSyncDialogOpen && (
        <WindowsLiveSyncDialog
          isOpen={isWindowsLiveSyncDialogOpen}
          onOpenChange={setIsWindowsLiveSyncDialogOpen}
          vm={liveSyncVm}
          waveId={wave.id}
        />
      )}
      {fileDetailsVm && (
        <FileDetailsDialog
          isOpen={!!fileDetailsVm}
          onOpenChange={(isOpen) => !isOpen && setFileDetailsVm(null)}
          vm={fileDetailsVm}
          waveId={wave.id}
          checkFilesForVm={checkFilesForVm}
        />
      )}
      {chkdskVm && (
        <ChkdskReportDialog
          isOpen={!!chkdskVm}
          onOpenChange={(isOpen) => !isOpen && setChkdskVm(null)}
          vm={chkdskVm}
          waveId={wave.id}
          checkFilesForVm={checkFilesForVm}
        />
      )}
      {viewingLogsForVm && (
        <Dialog open={!!viewingLogsForVm} onOpenChange={(isOpen) => !isOpen && setViewingLogsForVm(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Preparation Logs: {safeRender(viewingLogsForVm.cloneName)}</DialogTitle>
              <DialogDescription>
                Full output from the VM instance preparation process.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96 w-full rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap">
                {typeof viewingLogsForVm.preparationLogs === 'string' ? viewingLogsForVm.preparationLogs : "No logs available."}
              </pre>
            </ScrollArea>
            <DialogFooter>
                <Button onClick={() => setViewingLogsForVm(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
