
"use client";

import React, { useState, useMemo } from "react";
import type { Host, VirtualMachine, HostWithPassword } from "@/types";
import { AddHostForm } from "@/components/hosts/add-host-form";
import { HostsTable } from "@/components/hosts/hosts-table";
import { EditHostDialog } from "@/components/hosts/edit-host-dialog";
import { VmsTable } from "@/components/vms/vms-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/context/AppContext";

const mockVms: VirtualMachine[] = []; // No VMs on VME hosts for now

export default function VMEHostsPage() {
  const { vmeHosts, addVmeHost, updateVmeHost, deleteVmeHost } = useAppContext();
  const [editingHost, setEditingHost] = useState<Host | null>(null);

  const handleEditHost = (id: string) => {
    const hostToEdit = vmeHosts.find((host) => host.id === id);
    if (hostToEdit) {
      setEditingHost(hostToEdit);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            VME Hosts
          </h1>
          <p className="text-muted-foreground">
            Manage your target VME hypervisor hosts.
          </p>
        </div>
        <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Add New VME Host</CardTitle>
              <CardDescription>
                Add a new VME host to manage. Include Morpheus details if applicable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddHostForm onAddHost={addVmeHost} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Managed VME Hosts</CardTitle>
              <CardDescription>
                View, edit, or delete your added VME hosts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HostsTable 
                hosts={vmeHosts} 
                onEditHost={handleEditHost}
                onDeleteHost={deleteVmeHost}
                onViewVms={() => {}} // No VMs on VME hosts for now
                showViewVms={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      {editingHost && (
        <EditHostDialog
          host={editingHost}
          onOpenChange={(isOpen) => !isOpen && setEditingHost(null)}
          onUpdateHost={updateVmeHost as (updatedHost: HostWithPassword) => void}
        />
      )}
    </>
  );
}
