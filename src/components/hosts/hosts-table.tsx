
"use client";

import React, { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import type { Host } from "@/types";
import { Button } from "@/components/ui/button";
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

type HostsTableProps = {
  hosts: Host[];
  onEditHost: (id: string) => void;
  onViewVms: (id: string) => void;
  onDeleteHost: (id: string) => void;
  showViewVms?: boolean;
};

export function HostsTable({ hosts, onEditHost, onViewVms, onDeleteHost, showViewVms = true }: HostsTableProps) {
  const handleDelete = (host: Host) => {
    onDeleteHost(host.id);
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>IP Address</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Morpheus FQDN</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hosts.length > 0 ? (
          hosts.map((host) => (
            <TableRow key={host.id}>
              <TableCell className="font-medium">{host.ipAddress}</TableCell>
              <TableCell>{host.username}</TableCell>
              <TableCell>{host.morpheusFqdn || "N/A"}</TableCell>
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
                      <DropdownMenuItem onClick={() => onEditHost(host.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {showViewVms && (
                        <DropdownMenuItem onClick={() => onViewVms(host.id)}>
                           <Eye className="mr-2 h-4 w-4" />
                          View VMs
                        </DropdownMenuItem>
                      )}
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
                        This action cannot be undone. This will permanently delete the host
                        <span className="font-semibold text-foreground"> {host.ipAddress}</span>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(host)} className="bg-destructive hover:bg-destructive/90">
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
            <TableCell colSpan={4} className="h-24 text-center">
              No hosts added yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </>
  );
}
