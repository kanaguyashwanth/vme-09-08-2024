

"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Host, VirtualMachine, MigrationWave, HostWithPassword, Stage, StageStatus } from '@/types';
import { toast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';


interface AppContextType {
  hosts: Host[];
  vmeHosts: HostWithPassword[];
  waves: MigrationWave[];
  vms: VirtualMachine[];
  isFetchingVms: boolean;
  addHost: (newHost: Omit<HostWithPassword, "id">) => boolean;
  deleteHost: (id: string) => void;
  updateHost: (updatedHost: HostWithPassword) => void;
  addVmeHost: (newHost: Omit<HostWithPassword, "id">) => boolean;
  deleteVmeHost: (id: string) => void;
  updateVmeHost: (updatedHost: HostWithPassword) => void;
  createWave: (name: string, vms: VirtualMachine[]) => void;
  deleteWave: (waveIds: string[]) => void;
  renameWave: (waveId: string, newName: string) => void;
  addVmsToWave: (waveId: string, vmsToAdd: VirtualMachine[]) => void;
  removeVmsFromWave: (waveId: string, vmIdsToRemove: string[]) => void;
  fetchVmsForHost: (hostId: string) => void;
  getHostWithPassword: (hostId: string) => HostWithPassword | undefined;
  generatePreCheckReport: (wave: MigrationWave) => Promise<boolean>;
  mapTargetToVms: (waveId: string, vmIds: string[], targetHostId: string) => void;
  initiateCloning: (waveId: string, vmIds: string[]) => Promise<void>;
  prepareAndMigrateWave: (waveId: string) => Promise<void>;
  prepareCloneForTarget: (waveId: string, vmId: string) => Promise<void>;
  createTargetVm: (waveId: string, vmId: string) => Promise<void>;
  checkMigrationProgress: (waveId: string, vmId: string) => Promise<void>;
  checkVmStatusForWave: (waveId: string) => Promise<void>;
  updateVmInWave: (waveId: string, vmId: string, updates: Partial<VirtualMachine>) => void;
  liveSyncAction: (action: "start" | "stop" | "logs", vm: VirtualMachine, targetCreds: Pick<VirtualMachine, 'liveSyncTargetIp' | 'liveSyncUsername' | 'liveSyncPassword'>) => Promise<any>;
  startWindowsLiveSync: (vm: VirtualMachine, targetCreds: Pick<VirtualMachine, 'liveSyncTargetIp' | 'liveSyncUsername' | 'liveSyncPassword'>) => Promise<any>;
  getLiveSyncLogs: (sourceIp: string, targetIp: string, osType: 'linux' | 'windows') => Promise<{ logs: string } | null>;
  installMorpheusAgent: (waveId: string) => Promise<void>;
  updateWaveStage: (waveId: string, stageName: string, status: StageStatus, content?: any) => void;
  performPingTest: (waveId: string) => Promise<void>;
  checkFilesForVm: (waveId: string, vmId: string) => Promise<void>;
  shutdownSourceVm: (waveId: string, vmId: string) => Promise<void>;
  reassignVmIp: (waveId: string, vmId: string, targetIp: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<HostWithPassword[]>([]);
  const [vmeHosts, setVmeHosts] = useState<HostWithPassword[]>([]);
  const [waves, setWaves] = useState<MigrationWave[]>([]);
  const [vms, setVms] = useState<VirtualMachine[]>([]);
  const [isFetchingVms, setIsFetchingVms] = useState(false);
  
  const showToast = useCallback((message: string, options: any = {}) => {
      let description = message;
      if (typeof message === 'object' && message !== null && 'detail' in message) {
          description = (message as any).detail;
      }
      toast({ description, ...options });
  }, []);

  const updateVmState = useCallback((waveId: string, vmId: string, updates: Partial<VirtualMachine>) => {
    setWaves(prev => prev.map(w => w.id === waveId ? {
        ...w,
        vms: w.vms.map(v => v.id === vmId ? { ...v, ...updates } : v)
    } : w));
  }, []);

  const updateWaveStage = useCallback((waveId: string, stageName: string, status: StageStatus, content?: any) => {
    setWaves(prevWaves => prevWaves.map(wave => {
        if (wave.id === waveId) {
            const newStages = wave.stages?.map(stage => 
                stage.name === stageName 
                    ? { ...stage, status, content: content !== undefined ? content : stage.content } 
                    : stage
            ) || [];
            return { ...wave, stages: newStages };
        }
        return wave;
    }));
  }, []);


  const addHost = (newHost: Omit<HostWithPassword, "id">) => {
    if (hosts.some(host => host.ipAddress === newHost.ipAddress)) {
      showToast("A source host with this IP address already exists.", { title: "Error adding host", variant: "destructive" });
      return false;
    }
    const id = `source-host-${Date.now()}`;
    const newHostWithId: HostWithPassword = { ...newHost, id };
    
    setHosts(prevHosts => [...prevHosts, newHostWithId]);

    showToast(`Successfully added source host ${newHost.ipAddress}.`, { title: "Host Added" });
    return true;
  };

  const deleteHost = (id: string) => {
    const hostToDelete = hosts.find(host => host.id === id);
    if (hostToDelete) {
        setHosts(prevHosts => prevHosts.filter(host => host.id !== id));
        setVms(prevVms => prevVms.filter(vm => vm.hostId !== id));
        setWaves(prevWaves => prevWaves.map(wave => ({
            ...wave,
            vms: wave.vms.filter(vm => vm.hostId !== id)
        })));
        
        showToast(`Successfully deleted source host ${hostToDelete.ipAddress}.`, { title: "Host Deleted", variant: "destructive" });
    }
  };

  const updateHost = (updatedHost: HostWithPassword) => {
    setHosts(prevHosts => prevHosts.map(host => (host.id === updatedHost.id ? { ...host, ...updatedHost } : host)));
    showToast(`Successfully updated source host ${updatedHost.ipAddress}.`, { title: "Host Updated" });
  };
  
  const addVmeHost = (newHost: Omit<HostWithPassword, "id">) => {
    if (vmeHosts.some(host => host.ipAddress === newHost.ipAddress)) {
      showToast("A VME host with this IP address already exists.", { title: "Error adding host", variant: "destructive" });
      return false;
    }
    const newHostWithId = { ...newHost, id: `vme-host-${Date.now()}` };
    setVmeHosts(prevHosts => [...prevHosts, newHostWithId]);
    showToast(`Successfully added VME host ${newHost.ipAddress}.`, { title: "VME Host Added" });
    return true;
  };

  const deleteVmeHost = (id: string) => {
    const hostToDelete = vmeHosts.find(host => host.id === id);
    if (hostToDelete) {
        setVmeHosts(prevHosts => prevHosts.filter(host => host.id !== id));
        showToast(`Successfully deleted VME host ${hostToDelete.ipAddress}.`, { title: "VME Host Deleted", variant: "destructive" });
    }
  };

  const updateVmeHost = (updatedHost: HostWithPassword) => {
    setVmeHosts(prevHosts => prevHosts.map(host => (host.id === updatedHost.id ? { ...host, ...updatedHost } : host)));
    showToast(`Successfully updated VME host ${updatedHost.ipAddress}.`, { title: "VME Host Updated" });
  };

  const createWave = (name: string, vms: VirtualMachine[]) => {
    const newWave: MigrationWave = {
      id: `wave-${Date.now()}`,
      name,
      vms,
      createdAt: new Date(),
      stages: [
        { name: "Pre-Check", status: "pending" },
        { name: "Migration Preparation", status: "pending" },
        { name: "Replication", status: "pending" },
      ],
    };
    setWaves(prev => [...prev, newWave]);
    showToast(`Successfully created wave "${name}" with ${vms.length} VMs.`, { title: "Wave Created" });
  };

  const deleteWave = (waveIds: string[]) => {
    setWaves(prev => prev.filter(wave => !waveIds.includes(wave.id)));
    showToast(`Successfully deleted ${waveIds.length} wave(s).`, { title: "Wave(s) Deleted", variant: "destructive" });
  };

  const renameWave = (waveId: string, newName: string) => {
    setWaves(prev => prev.map(wave => 
        wave.id === waveId ? { ...wave, name: newName } : wave
    ));
    showToast(`Wave has been renamed to "${newName}".`, { title: "Wave Renamed" });
  }

  const addVmsToWave = (waveId: string, vmsToAdd: VirtualMachine[]) => {
    let waveName = "";
    let addedCount = 0;
    setWaves(prev => prev.map(wave => {
        if (wave.id === waveId) {
            waveName = wave.name;
            const existingVmIds = new Set(wave.vms.map(vm => vm.id));
            const newVms = vmsToAdd.filter(vm => !existingVmIds.has(vm.id));
            addedCount = newVms.length;
            if (newVms.length > 0) {
                return { ...wave, vms: [...wave.vms, ...newVms] };
            }
        }
        return wave;
    }));

    if (addedCount > 0) {
        showToast(`Added ${addedCount} new VM(s) to wave "${waveName}".`, { title: "VMs Added" });
    } else if (waveName) {
        showToast(`All selected VMs are already in the wave "${waveName}".`, { title: "No New VMs Added" });
    }
  }

  const removeVmsFromWave = (waveId: string, vmIdsToRemove: string[]) => {
      let waveName = "";
      let removedCount = 0;
      setWaves(prev => prev.map(wave => {
          if (wave.id === waveId) {
              waveName = wave.name;
              const vmsBeforeRemoval = wave.vms.length;
              const vmsAfterRemoval = wave.vms.filter(vm => !vmIdsToRemove.includes(vm.id));
              removedCount = vmsBeforeRemoval - vmsAfterRemoval.length;
              return { ...wave, vms: vmsAfterRemoval };
          }
          return wave;
      }));

      if(removedCount > 0) {
        showToast(`Removed ${removedCount} VM(s) from wave "${waveName}".`, { title: "VMs Removed" });
      }
  }
  
  const fetchVmsForHost = async (hostId: string) => {
    const host = getHostWithPassword(hostId);

    if (!host || !host.password) {
        showToast("Host details or credentials not found.", { title: "Error", variant: "destructive" });
        return;
    }

    setIsFetchingVms(true);
    setVms([]);
    try {
        const response = await fetch('http://localhost:8000/api/vms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: host.id, ipAddress: host.ipAddress, username: host.username, password: host.password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch VMs');
        }

        const data: VirtualMachine[] = await response.json();
        setVms(data);
        showToast(`Successfully fetched ${data.length} VMs from ${host.ipAddress}.`, { title: "VMs Fetched" });
    } catch (error: any) {
        setVms([]);
        showToast(error.message || 'An unknown error occurred.', { title: "Error Fetching VMs", variant: "destructive" });
    } finally {
        setIsFetchingVms(false);
    }
  };

  const getHostWithPassword = (hostId: string): HostWithPassword | undefined => {
      return hosts.find(h => h.id === hostId) || vmeHosts.find(h => h.id === hostId);
  }

  const generatePreCheckReport = async (wave: MigrationWave): Promise<boolean> => {
    if (wave.vms.length === 0) {
      showToast("No VMs in the wave to generate a report for.", { title: "Report Generation Failed", variant: "destructive" });
      updateWaveStage(wave.id, 'Pre-Check', 'failure', <p className="text-sm font-medium text-destructive">No VMs in wave.</p>);
      return false;
    }

    const firstVmHostId = wave.vms[0].hostId;
    const host = getHostWithPassword(firstVmHostId);

    if (!host || !host.password) {
        showToast("Source host credentials not found for VMs in this wave.", { title: "Report Generation Failed", variant: "destructive" });
        updateWaveStage(wave.id, 'Pre-Check', 'failure', <p className="text-sm font-medium text-destructive">Host credentials not found.</p>);
        return false;
    }

    const vmNames = wave.vms.map(vm => vm.name);

    try {
      const response = await fetch('http://localhost:8000/api/precheck-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: { id: host.id, ipAddress: host.ipAddress, username: host.username, password: host.password },
          vmNames: vmNames,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate report');
      }

      const blob = await response.blob();
      saveAs(blob, `pre-check-report-wave-${wave.name}.pdf`);
      showToast("Pre-check report downloaded successfully.", { title: "Report Generated" });
      updateWaveStage(wave.id, 'Pre-Check', 'success', <p className="text-sm font-medium text-green-600">Pre-Check report downloaded successfully.</p>);
      return true;

    } catch (error: any) {
      showToast(error.message || 'An unknown error occurred.', { title: "Error Generating Report", variant: "destructive" });
      updateWaveStage(wave.id, 'Pre-Check', 'failure', <p className="text-sm font-medium text-destructive">{error.message}</p>);
      return false;
    }
  };

  const mapTargetToVms = (waveId: string, vmIds: string[], targetHostId: string) => {
    const targetHost = vmeHosts.find(h => h.id === targetHostId);
    if (!targetHost) {
        showToast("Target host not found.", { title: "Error", variant: "destructive" });
        return;
    }

    setWaves(prevWaves => prevWaves.map(wave => {
        if (wave.id === waveId) {
            const updatedVms = wave.vms.map(vm => {
                if (vmIds.includes(vm.id)) {
                    return { ...vm, targetName: targetHost.ipAddress };
                }
                return vm;
            });
            return { ...wave, vms: updatedVms };
        }
        return wave;
    }));

    showToast(`Mapped ${vmIds.length} VM(s) to target ${targetHost.ipAddress}.`, { title: "Target Mapped" });
  };

  const initiateCloning = async (waveId: string, vmIds: string[]) => {
    const wave = waves.find(w => w.id === waveId);
    if (!wave) return;

    for (const vmId of vmIds) {
      const vm = wave.vms.find(v => v.id === vmId);
      if (!vm) continue;
      
      const host = getHostWithPassword(vm.hostId);
      if (!host || !host.password) {
        showToast(`Credentials not found for host of VM ${vm.name}.`, { title: "Cloning Failed", variant: "destructive" });
        continue;
      }
      
      if (vm.powerState !== 'poweredOn') {
        updateVmState(waveId, vmId, { cloneTaskId: 'not-powered-on', cloneStatus: 'success', cloneName: vm.name });
        continue;
      }

      try {
        const response = await fetch('http://localhost:8000/api/vms/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, vmName: vm.name }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `Failed to start cloning for ${vm.name}.`);
        }
        
        if (result.status === 'already_exists') {
            updateVmState(waveId, vmId, { cloneTaskId: 'existing-clone', cloneProgress: 100, cloneStatus: 'success', cloneName: result.cloneName });
        } else if (result.taskId) {
            updateVmState(waveId, vmId, { cloneTaskId: result.taskId, cloneStatus: 'running', cloneProgress: 0, cloneName: result.cloneName });
        }

      } catch (error: any) {
        showToast(error.message, { title: "Cloning Error", variant: "destructive" });
        updateVmState(waveId, vmId, { cloneTaskId: 'error-clone', cloneStatus: 'error', cloneProgress: 0 });
      }
    }
  };

  const prepareAndMigrateWave = async (waveId: string) => {
    const wave = waves.find(w => w.id === waveId);
    if (!wave) {
        toast({ title: "Error", description: "Wave not found.", variant: "destructive" });
        return;
    }

    updateWaveStage(waveId, 'Migration Preparation', 'running');

    const processQueue = [...wave.vms]; 

    const processVm = async (vm: VirtualMachine) => {
        let currentVm = vm;

        // Step 1: Clone
        if (!currentVm.cloneTaskId || currentVm.cloneStatus !== 'success') {
            await initiateCloning(waveId, [currentVm.id]);
            // Poll for clone completion
            await new Promise<void>(resolve => {
                const interval = setInterval(() => {
                    setWaves(currentWaves => {
                        const updatedWave = currentWaves.find(w => w.id === waveId);
                        const updatedVm = updatedWave?.vms.find(v => v.id === vm.id);
                        if (updatedVm?.cloneStatus === 'success' || updatedVm?.cloneStatus === 'error') {
                            currentVm = updatedVm;
                            clearInterval(interval);
                            resolve();
                        }
                        return currentWaves;
                    });
                }, 5000);
            });
        }
        
        if (currentVm.cloneStatus === 'error') return; // Stop if cloning failed

        // Step 2: Prepare
        if (currentVm.preparationStatus !== 'success') {
            await prepareCloneForTarget(waveId, currentVm.id);
            // Poll for preparation completion
            await new Promise<void>(resolve => {
                const interval = setInterval(() => {
                    setWaves(currentWaves => {
                        const updatedWave = currentWaves.find(w => w.id === waveId);
                        const updatedVm = updatedWave?.vms.find(v => v.id === vm.id);
                        if (updatedVm?.preparationStatus === 'success' || updatedVm?.preparationStatus === 'error') {
                            currentVm = updatedVm;
                            clearInterval(interval);
                            resolve();
                        }
                        return currentWaves;
                    });
                }, 5000);
            });
        }
        
        if (currentVm.preparationStatus === 'error') return; // Stop if preparation failed

        // Step 3: Migrate
        if (currentVm.migrationStatus !== 'success') {
            await createTargetVm(waveId, currentVm.id);
        }
    };
    
    for (const vm of processQueue) {
        await processVm(vm);
    }
  };
  
  const prepareCloneForTarget = async (waveId: string, vmId: string) => {
    let vmToPrepare: VirtualMachine | undefined;
    setWaves(currentWaves => {
        const wave = currentWaves.find(w => w.id === waveId);
        vmToPrepare = wave?.vms.find(v => v.id === vmId);
        return currentWaves;
    });

    if (!vmToPrepare || !vmToPrepare.cloneName) {
        showToast(`Clone for VM ${vmToPrepare?.name} not found.`, { title: "Preparation Failed", variant: "destructive" });
        return;
    }

    const host = getHostWithPassword(vmToPrepare.hostId);
    if (!host || !host.password) {
        showToast(`Credentials not found for host of VM ${vmToPrepare.name}.`, { title: "Preparation Failed", variant: "destructive" });
        return;
    }
    
    updateVmState(waveId, vmId, { preparationStatus: 'running', preparationLogs: 'Starting preparation...' });

    try {
        const response = await fetch('http://localhost:8000/api/vms/prepare-for-target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, cloneVmName: vmToPrepare.cloneName }),
        });

        if (!response.ok) {
            throw new Error("Failed to start preparation task.");
        }
        
    } catch (error: any) {
        updateVmState(waveId, vmId, { preparationStatus: 'error', preparationLogs: error.message || "An unknown error occurred." });
    }
  };

  const createTargetVm = async (waveId: string, vmId: string) => {
    let vmToMigrate: VirtualMachine | undefined;
    let sourceHost: HostWithPassword | undefined;
    let targetHost: HostWithPassword | undefined;

    setWaves(currentWaves => {
      const wave = currentWaves.find(w => w.id === waveId);
      vmToMigrate = wave?.vms.find(v => v.id === vmId);
      if (vmToMigrate) {
          sourceHost = getHostWithPassword(vmToMigrate.hostId);
          targetHost = vmeHosts.find(h => h.ipAddress === vmToMigrate?.targetName);
      }
      return currentWaves;
    });

    if (!vmToMigrate || !vmToMigrate.cloneName || !vmToMigrate.targetName) {
        showToast(`Required VM details are missing.`, { title: "Migration Failed", variant: "destructive" });
        return;
    }
    
    if (!sourceHost || !sourceHost.password || !targetHost || !targetHost.password) {
        showToast(`Host credentials not found.`, { title: "Migration Failed", variant: "destructive" });
        return;
    }

    updateVmState(waveId, vmId, { migrationStatus: 'running', migrationLogs: 'Initiating migration...' });

    try {
        await fetch('http://localhost:8000/api/vms/create-target-vm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sourceHost, 
                targetHost,
                cloneVmName: vmToMigrate.cloneName 
            }),
        });
    } catch (error: any) {
         updateVmState(waveId, vmId, { migrationStatus: 'error', migrationLogs: error.message || "An unknown error occurred." });
    }
  };

  const checkMigrationProgress = useCallback(async (waveId: string, vmId: string) => {
      let vm: VirtualMachine | undefined;
      setWaves(currentWaves => {
        const wave = currentWaves.find(w => w.id === waveId);
        vm = wave?.vms.find(v => v.id === vmId);
        return currentWaves;
      });
      if(!vm) return;

      try {
          if (vm.cloneStatus === 'running' && vm.cloneTaskId) {
                const host = getHostWithPassword(vm.hostId);
                if (!host || !host.password) return;
                const response = await fetch(`http://localhost:8000/api/tasks/${vm.cloneTaskId}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(host),
                });
                if (response.status === 404) { // Task expired or completed
                    updateVmState(waveId, vmId, { cloneProgress: 100, cloneStatus: 'success' });
                    return;
                }
                if (!response.ok) {
                    updateVmState(waveId, vmId, { cloneStatus: 'error', cloneProgress: 0 }); return;
                }
                const { progress, state } = await response.json();
                let status: VirtualMachine['cloneStatus'] = 'running';
                if (state === 'success') status = 'success';
                if (state === 'error') status = 'error';
                updateVmState(waveId, vmId, { cloneProgress: progress, cloneStatus: status });
          }
          else if (vm.preparationStatus === 'running' && vm.cloneName) {
                const response = await fetch(`http://localhost:8000/api/vms/preparation-status/${vm.cloneName}`);
                if (response.ok) {
                    const data = await response.json();
                    updateVmState(waveId, vmId, { preparationStatus: data.status, preparationLogs: data.logs });
                }
          }
          else if (vm.migrationStatus === 'running' && vm.cloneName) {
              const response = await fetch(`http://localhost:8000/api/vms/migration-status/${vm.cloneName}`);
              if (response.ok) {
                  const data = await response.json();
                  updateVmState(waveId, vmId, { migrationStatus: data.status, migrationProgress: data.progress, migrationLogs: data.logs });
              }
          }
      } catch (error) {
          console.error(`Failed to check progress for VM ${vm.name}:`, error);
      }
  }, [waves, getHostWithPassword, updateVmState]);

  const checkVmStatusForWave = async (waveId: string) => {
    const wave = waves.find(w => w.id === waveId);
    if (!wave) return;
    const hostId = wave.vms[0]?.hostId;
    if (!hostId) {
        showToast("No VMs in wave to check.", { title: "Error", variant: "destructive" });
        return;
    }
    const host = getHostWithPassword(hostId);
    if (!host) {
         showToast("Host credentials not found.", { title: "Error", variant: "destructive" });
        return;
    }

    try {
        const response = await fetch('http://localhost:8000/api/vms/replication/check-vms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, vm_names: wave.vms.map(vm => vm.name) }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to check VM status");
        }
        const results = await response.json();
        results.forEach((result: { name: string, powerState: VirtualMachine['powerState'], guestOs: string, osType: 'Windows' | 'Linux' | 'Unknown' }) => {
            const vmToUpdate = wave.vms.find(vm => vm.name === result.name);
            if(vmToUpdate) {
                updateVmInWave(waveId, vmToUpdate.id, { powerState: result.powerState, guestOs: result.guestOs, osType: result.osType });
            }
        });

    } catch (error: any) {
        showToast(error.message, { title: "Error", variant: "destructive" });
    }
  };

  const liveSyncAction = async (action: "start" | "stop" | "logs", vm: VirtualMachine, targetCreds: Pick<VirtualMachine, 'liveSyncTargetIp' | 'liveSyncUsername' | 'liveSyncPassword'>) => {
    const { ipAddress: source_ip } = vm;
    const { liveSyncTargetIp: target_ip, liveSyncUsername: username, liveSyncPassword: password } = targetCreds;
    
    if (!source_ip || source_ip === "N/A" || !target_ip || !username || !password) {
        showToast("Source/Target details are incomplete.", { title: "Error", variant: "destructive" });
        return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/vms/replication/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_ip, target_ip, username, password }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Live sync action failed");
      }
      return await response.json();
    } catch (error: any) {
      showToast(error.message, { title: "Live Sync Error", variant: "destructive" });
      return null;
    }
  };

  const getLiveSyncLogs = async (sourceIp: string, targetIp: string, osType: 'linux' | 'windows') => {
    try {
        const response = await fetch(`http://localhost:8000/api/vms/replication/logs/${sourceIp}/${targetIp}?os_type=${osType}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to fetch logs');
        }
        return await response.json();
    } catch(error: any) {
        showToast(error.message, { title: "Error Fetching Logs", variant: "destructive" });
        return null;
    }
  };

  const startWindowsLiveSync = async (vm: VirtualMachine, targetCreds: Pick<VirtualMachine, 'liveSyncTargetIp' | 'liveSyncUsername' | 'liveSyncPassword'>) => {
    const { ipAddress: source_ip } = vm;
    const { liveSyncTargetIp: target_ip, liveSyncUsername: username, liveSyncPassword } = targetCreds;
    const password = liveSyncPassword || "";

    if (!source_ip || source_ip === "N/A" || !target_ip || !username || !password) {
        showToast("Source/Target details are incomplete for Windows sync.", { title: "Error", variant: "destructive" });
        return null;
    }

    try {
        const response = await fetch(`http://localhost:8000/api/vms/replication/start-windows-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_ip,
                target_ip,
                username,
                password,
            }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Windows live sync action failed");
        }
        return await response.json();
    } catch (error: any) {
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : 'An unknown error occurred';
        showToast(errorMessage, { title: "Windows Sync Error", variant: "destructive" });
        return null;
    }
  };
  
  const installMorpheusAgent = async (waveId: string) => {
    const wave = waves.find(w => w.id === waveId);
    if (!wave) return;

    for (const vm of wave.vms) {
        const targetHost = vmeHosts.find(h => h.ipAddress === vm.targetName);

        if (!targetHost || !targetHost.morpheusFqdn || !targetHost.morpheusApiKey || !vm.liveSyncUsername || !vm.liveSyncPassword) {
            updateVmState(waveId, vm.id, { morpheusAgentStatus: 'failed' });
            showToast(`Skipping agent install for ${vm.name}: Missing Morpheus or VM credentials.`, { variant: "destructive" });
            continue;
        }

        updateVmState(waveId, vm.id, { morpheusAgentStatus: 'running' });

        try {
            const response = await fetch('http://localhost:8000/api/vms/install-morpheus-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: targetHost.morpheusApiKey,
                    vme_host: targetHost.morpheusFqdn,
                    vm_name: vm.name,
                    vm_username: vm.liveSyncUsername,
                    vm_password: vm.liveSyncPassword,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Agent installation failed for ${vm.name}`);
            }

            updateVmState(waveId, vm.id, { morpheusAgentStatus: 'success' });
            showToast(`Agent installation started for ${vm.name}.`, { title: "Success" });

        } catch (error: any) {
            updateVmState(waveId, vm.id, { morpheusAgentStatus: 'failed' });
            showToast(error.message, { title: `Agent Install Error for ${vm.name}`, variant: "destructive" });
        }
    }
    updateWaveStage(waveId, 'Install Morpheus Agent', 'success');
  };

  const performPingTest = async (waveId: string) => {
    const wave = waves.find(w => w.id === waveId);
    if (!wave || wave.vms.length === 0) {
        showToast("No VMs in wave to perform ping test.", { title: "Ping Test Error", variant: "destructive" });
        return;
    }

    const hostnames = wave.vms.map(vm => vm.hostname).filter((h): h is string => !!h && h !== "N/A");

    // Set all to pending
    wave.vms.forEach(vm => {
        if (hostnames.includes(vm.hostname)) {
            updateVmState(waveId, vm.id, { pingStatus: 'pending' });
        } else {
            updateVmState(waveId, vm.id, { pingStatus: 'failed' });
        }
    });

    try {
        const response = await fetch('http://localhost:8000/api/vms/ping-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostnames }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Ping test failed");
        }

        const results: Record<string, 'success' | 'failed'> = await response.json();
        
        wave.vms.forEach(vm => {
            if (vm.hostname in results) {
                updateVmState(waveId, vm.id, { pingStatus: results[vm.hostname] });
            }
        });
        showToast("Ping test completed.", { title: "Ping Test" });

    } catch (error: any) {
        showToast(error.message, { title: "Ping Test Error", variant: "destructive" });
         wave.vms.forEach(vm => {
            if (hostnames.includes(vm.hostname)) {
                updateVmState(waveId, vm.id, { pingStatus: 'failed' });
            }
        });
    }
  };

  const checkFilesForVm = async (waveId: string, vmId: string) => {
    const wave = waves.find(w => w.id === waveId);
    const vm = wave?.vms.find(v => v.id === vmId);

    if (!vm || !vm.ipAddress || !vm.liveSyncUsername || !vm.liveSyncPassword) {
      showToast("VM credentials for live sync not found.", { title: "Error", variant: "destructive" });
      return;
    }
    
    const hostsToCheck: { ip_address: string, username: string, password?: string }[] = [{ 
      ip_address: vm.ipAddress, 
      username: vm.liveSyncUsername, 
      password: vm.liveSyncPassword 
    }];

    if (vm.liveSyncTargetIp) {
      hostsToCheck.push({ 
        ip_address: vm.liveSyncTargetIp, 
        username: vm.liveSyncUsername, 
        password: vm.liveSyncPassword 
      });
    }

    const endpoint = vm.osType === 'Windows' ? 'check-files-windows' : 'check-files';
    
    try {
        const response = await fetch(`http://localhost:8000/api/vms/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hosts: hostsToCheck }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to ${endpoint}`);
        }
        const data = await response.json();
        
        const updatePayload: Partial<VirtualMachine> = {};

        if (vm.osType === 'Windows') {
            if (data[vm.ipAddress]) {
                updatePayload.sourceChkdskReport = data[vm.ipAddress];
            }
            if (vm.liveSyncTargetIp && data[vm.liveSyncTargetIp]) {
                updatePayload.targetChkdskReport = data[vm.liveSyncTargetIp];
            }
        } else {
            if (data[vm.ipAddress] >= 0) {
                updatePayload.sourceFileCount = data[vm.ipAddress];
            }
            if (vm.liveSyncTargetIp && data[vm.liveSyncTargetIp] >= 0) {
                updatePayload.targetFileCount = data[vm.liveSyncTargetIp];
            }
        }
        
        if (Object.keys(updatePayload).length > 0) {
            updateVmInWave(waveId, vmId, updatePayload);
        }

    } catch (error: any) {
        showToast(error.message, { title: `Error on ${endpoint}`, variant: 'destructive' });
    }
  };

  const shutdownSourceVm = async (waveId: string, vmId: string) => {
    const wave = waves.find(w => w.id === waveId);
    const vm = wave?.vms.find(v => v.id === vmId);
    if (!wave || !vm) return;
  
    const host = getHostWithPassword(vm.hostId);
    if (!host || !host.password) {
      showToast(`Credentials not found for host of VM ${vm.name}.`, { title: "Shutdown Failed", variant: "destructive" });
      updateVmState(waveId, vmId, { shutdownStatus: 'error' });
      return;
    }
  
    updateVmState(waveId, vmId, { shutdownStatus: 'shutting-down' });
  
    try {
      const response = await fetch('http://localhost:8000/api/vms/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, vmName: vm.name }),
      });
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.detail || `Failed to shut down ${vm.name}.`);
      }
  
      showToast(result.message, { title: "Shutdown Initiated" });
  
      // Poll for status change
      const pollInterval = setInterval(async () => {
        await checkVmStatusForWave(waveId);
        const updatedWave = waves.find(w => w.id === waveId);
        const updatedVm = updatedWave?.vms.find(v => v.id === vmId);
        if (updatedVm?.powerState === 'poweredOff') {
          updateVmState(waveId, vmId, { shutdownStatus: 'success' });
          clearInterval(pollInterval);
        }
      }, 5000);
  
    } catch (error: any) {
      showToast(error.message, { title: "Shutdown Error", variant: "destructive" });
      updateVmState(waveId, vmId, { shutdownStatus: 'error' });
    }
  };

  const reassignVmIp = async (waveId: string, vmId: string, targetIp: string) => {
    const wave = waves.find(w => w.id === waveId);
    const vm = wave?.vms.find(v => v.id === vmId);
    if (!wave || !vm) {
      showToast("VM not found in wave.", { title: "Error", variant: "destructive" });
      return;
    }

    if (!vm.liveSyncTargetIp || !vm.liveSyncUsername || !vm.liveSyncPassword) {
      showToast(`VM credentials for ${vm.name} not found.`, { title: "IP Reassignment Failed", variant: "destructive" });
      updateVmState(waveId, vmId, { ipReassignmentStatus: 'failed' });
      return;
    }

    if (!vm.osType || (vm.osType !== 'Windows' && vm.osType !== 'Linux')) {
      showToast(`IP reassignment is only supported for Windows and Linux VMs.`, { title: "Not Supported", variant: "destructive" });
      updateVmState(waveId, vmId, { ipReassignmentStatus: 'failed' });
      return;
    }

    updateVmState(waveId, vmId, { ipReassignmentStatus: 'running', newTargetIp: targetIp, ipReassignmentLogs: 'Connecting to VM via SSH...' });

    try {
      // Update logs periodically
      updateVmState(waveId, vmId, { ipReassignmentLogs: `${vm.osType} - Detecting network configuration...` });
      
      const response = await fetch('http://localhost:8000/api/vms/reassign-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_ip: vm.liveSyncTargetIp,
          target_ip: targetIp,
          username: vm.liveSyncUsername,
          password: vm.liveSyncPassword,
          os_type: vm.osType || 'Unknown',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Failed to reassign IP for ${vm.name}.`);
      }

      showToast(result.message, { title: "IP Reassignment Success" });
      updateVmState(waveId, vmId, { 
        ipReassignmentStatus: 'success', 
        liveSyncTargetIp: targetIp,
        ipReassignmentLogs: result.logs || 'IP reassignment completed successfully'
      });

    } catch (error: any) {
      showToast(error.message, { title: "IP Reassignment Error", variant: "destructive" });
      updateVmState(waveId, vmId, { 
        ipReassignmentStatus: 'failed',
        ipReassignmentLogs: error.message || 'IP reassignment failed'
      });
    }
  };

  const updateVmInWave = (waveId: string, vmId: string, updates: Partial<VirtualMachine>) => {
    updateVmState(waveId, vmId, updates);
  };

  const value = {
    hosts,
    vmeHosts,
    waves,
    vms,
    isFetchingVms,
    addHost,
    deleteHost,
    updateHost,
    addVmeHost,
    deleteVmeHost,
    updateVmeHost,
    createWave,
    deleteWave,
    renameWave,
    addVmsToWave,
    removeVmsFromWave,
    fetchVmsForHost,
    getHostWithPassword,
    generatePreCheckReport,
    mapTargetToVms,
    initiateCloning,
    prepareAndMigrateWave,
    prepareCloneForTarget,
    createTargetVm,
    checkMigrationProgress,
    checkVmStatusForWave,
    updateVmInWave,
    liveSyncAction,
    startWindowsLiveSync,
    getLiveSyncLogs,
    installMorpheusAgent,
    updateWaveStage,
    performPingTest,
    checkFilesForVm,
    shutdownSourceVm,
    reassignVmIp,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
