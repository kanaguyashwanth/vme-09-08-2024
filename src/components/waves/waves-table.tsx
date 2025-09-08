
"use client";

import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, Plus, Minus } from "lucide-react";
import type { MigrationWave } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type WavesTableProps = {
  waves: MigrationWave[];
  selectedWaves: MigrationWave[];
  onSelectedWavesChange: (waves: MigrationWave[]) => void;
  onDeleteWave: (wave: MigrationWave) => void;
  onRenameWave: (wave: MigrationWave) => void;
  onAddVms: (wave: MigrationWave) => void;
  onRemoveVms: (wave: MigrationWave) => void;
};

export function WavesTable({ waves, selectedWaves, onSelectedWavesChange, onDeleteWave, onRenameWave, onAddVms, onRemoveVms }: WavesTableProps) {
    
  const handleSelectWave = (wave: MigrationWave, isSelected: boolean) => {
    onSelectedWavesChange(
      isSelected
        ? [...selectedWaves, wave]
        : selectedWaves.filter((w) => w.id !== wave.id)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    onSelectedWavesChange(isSelected ? waves : []);
  };
    
  const isAllSelected = waves.length > 0 && selectedWaves.length === waves.length;

  return (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  aria-label="Select all waves"
                />
            </TableHead>
            <TableHead>Wave Name</TableHead>
            <TableHead>VM Count</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
            </TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {waves.length > 0 ? (
            waves.map((wave) => (
                <TableRow key={wave.id} data-state={selectedWaves.some(w => w.id === wave.id) && "selected"}>
                 <TableCell>
                    <Checkbox
                      checked={selectedWaves.some(w => w.id === wave.id)}
                      onCheckedChange={(checked) => handleSelectWave(wave, Boolean(checked))}
                      aria-label={`Select wave ${wave.name}`}
                    />
                  </TableCell>
                <TableCell className="font-medium">{wave.name}</TableCell>
                <TableCell>{wave.vms.length}</TableCell>
                <TableCell>{format(wave.createdAt, "PPP p")}</TableCell>
                <TableCell>
                    <AlertDialog>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <DropdownMenuItem onClick={() => onAddVms(wave)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add VMs
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => onRemoveVms(wave)}>
                                <Minus className="mr-2 h-4 w-4" />
                                Remove VMs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRenameWave(wave)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the wave
                                <span className="font-semibold text-foreground"> {wave.name}</span>.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteWave(wave)} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
                </TableRow>
            ))
            ) : (
            <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                No migration waves created yet.
                </TableCell>
            </TableRow>
            )}
        </TableBody>
        </Table>
    </div>
  );
}
