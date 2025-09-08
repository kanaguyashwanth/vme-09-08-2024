
"use client";

import React, { useState, useEffect } from "react";
import type { VirtualMachine, MigrationWave } from "@/types";
import { CreateWaveDialog } from "@/components/waves/create-wave-dialog";
import { WavesTable } from "@/components/waves/waves-table";
import { WaveDetails } from "@/components/waves/wave-details";
import { RenameWaveDialog } from "@/components/waves/rename-wave-dialog";
import { AddVmsToWaveDialog } from "@/components/waves/add-vms-to-wave-dialog";
import { RemoveVmsFromWaveDialog } from "@/components/waves/remove-vms-from-wave-dialog";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { PlusCircle, ChevronDown, Trash2 } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";

export default function WavePage() {
  const { waves, deleteWave, generatePreCheckReport, prepareAndMigrateWave, updateWaveStage } = useAppContext();
  const { toast } = useToast();
  
  const [isCreateWaveDialogOpen, setIsCreateWaveDialogOpen] = useState(false);
  const [isRenameWaveDialogOpen, setIsRenameWaveDialogOpen] = useState(false);
  const [isAddVmsDialogOpen, setIsAddVmsDialogOpen] = useState(false);
  const [isRemoveVmsDialogOpen, setIsRemoveVmsDialogOpen] = useState(false);

  const [selectedWaves, setSelectedWaves] = useState<MigrationWave[]>([]);
  const [waveToModify, setWaveToModify] = useState<MigrationWave | null>(null);

  useEffect(() => {
    if (selectedWaves.length > 0) {
      const selectedWaveIds = new Set(selectedWaves.map(w => w.id));
      const updatedSelectedWaves = waves.filter(w => selectedWaveIds.has(w.id));
      setSelectedWaves(updatedSelectedWaves);
    }
  }, [waves]);

  const handleDeleteWaves = (wavesToDelete: MigrationWave[]) => {
    const waveIdsToDelete = wavesToDelete.map(wave => wave.id);
    deleteWave(waveIdsToDelete);
    setSelectedWaves([]);
  }

  const openModifyDialog = (dialogSetter: (isOpen: boolean) => void, wave?: MigrationWave) => {
    const waveToProcess = wave || (selectedWaves.length === 1 ? selectedWaves[0] : null);
     if (waveToProcess) {
      setWaveToModify(waveToProcess);
      dialogSetter(true);
    }
  }
  
  const isDeleteDisabled = selectedWaves.length === 0;
  const isModifyDisabled = selectedWaves.length !== 1;

  const handlePerformPreChecks = async () => {
    if (selectedWaves.length !== 1) return;
    const wave = selectedWaves[0];
    toast({ title: "Generating Report", description: `Starting pre-check for wave "${wave.name}"...` });
    updateWaveStage(wave.id, "Pre-Check", "running");
    await generatePreCheckReport(wave);
  };
  
  const handlePrepareForMigration = async () => {
    if (selectedWaves.length !== 1) return;
    const wave = selectedWaves[0];
    toast({ title: "Migration Starting", description: `Preparing all VMs in wave "${wave.name}" for migration...` });
    updateWaveStage(wave.id, "Migration Preparation", "running");
    await prepareAndMigrateWave(wave.id);
  };


  const selectedWaveForDetails = selectedWaves.length === 1 ? selectedWaves[0] : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Migration Waves
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor your migration waves.
            </p>
          </div>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Actions
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsCreateWaveDialogOpen(true)}>
                  <PlusCircle className="mr-2" />
                  Create Wave
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <AlertDialogTrigger asChild>
                    <DropdownMenuItem disabled={isDeleteDisabled} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Wave
                    </DropdownMenuItem>
                </AlertDialogTrigger>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isModifyDisabled}>
                      Modify Wave
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => openModifyDialog(setIsAddVmsDialogOpen)}>Add VMs</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openModifyDialog(setIsRemoveVmsDialogOpen)}>Remove VMs</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openModifyDialog(setIsRenameWaveDialogOpen)}>Rename Wave</DropdownMenuItem>
                      </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isModifyDisabled}>
                      Migration Actions
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Pre-Migration</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                      <DropdownMenuItem onClick={handlePerformPreChecks}>Perform Pre-Checks</DropdownMenuItem>
                                      <DropdownMenuItem onClick={handlePrepareForMigration}>Prepare for Migration</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Setup Replication</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Replication Status</DropdownMenuItem>
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Migration Cutover</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                      <DropdownMenuItem disabled>Ping Test</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Delta Sync</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Shutdown Source VMs</DropdownMenuItem>
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Post-Migration</DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                      <DropdownMenuItem disabled>Remove VMware Tools</DropdownMenuItem>
                                      <DropdownMenuItem disabled>IP Reassignment</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Install Morpheus Agent</DropdownMenuItem>
                                      <DropdownMenuItem disabled>Reboot VMs</DropdownMenuItem>
                                  </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                          </DropdownMenuSub>
                      </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected wave(s).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteWaves(selectedWaves)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <WavesTable 
            waves={waves}
            selectedWaves={selectedWaves}
            onSelectedWavesChange={setSelectedWaves}
            onDeleteWave={(wave) => handleDeleteWaves([wave])}
            onAddVms={(wave) => openModifyDialog(setIsAddVmsDialogOpen, wave)}
            onRemoveVms={(wave) => openModifyDialog(setIsRemoveVmsDialogOpen, wave)}
            onRenameWave={(wave) => openModifyDialog(setIsRenameWaveDialogOpen, wave)}
        />
        
        {selectedWaveForDetails && <WaveDetails wave={selectedWaveForDetails} />}
      </div>
      <CreateWaveDialog
        isOpen={isCreateWaveDialogOpen}
        onOpenChange={setIsCreateWaveDialogOpen}
        preselectedVms={[]}
      />
      {waveToModify && (
        <>
            <RenameWaveDialog 
                isOpen={isRenameWaveDialogOpen}
                onOpenChange={(isOpen) => {
                    setIsRenameWaveDialogOpen(isOpen);
                    if (!isOpen) setWaveToModify(null);
                }}
                wave={waveToModify}
            />
            <AddVmsToWaveDialog
                isOpen={isAddVmsDialogOpen}
                onOpenChange={(isOpen) => {
                    setIsAddVmsDialogOpen(isOpen);
                    if (!isOpen) setWaveToModify(null);
                }}
                wave={waveToModify}
            />
            <RemoveVmsFromWaveDialog
                isOpen={isRemoveVmsDialogOpen}
                onOpenChange={(isOpen) => {
                    setIsRemoveVmsDialogOpen(isOpen);
                    if (!isOpen) setWaveToModify(null);
                }}
                wave={waveToModify}
            />
        </>
      )}
    </>
  );
}
