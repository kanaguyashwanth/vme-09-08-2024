
"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import type { Host, VirtualMachine } from "@/types";
import { AddHostForm } from "@/components/hosts/add-host-form";
import { HostsTable } from "@/components/hosts/hosts-table";
import { EditHostDialog } from "@/components/hosts/edit-host-dialog";
import { VmsTable } from "@/components/vms/vms-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/context/AppContext";

export default function HypervisorDetailPage() {
  const params = useParams();
  const hypervisor = typeof params.hypervisor === 'string' ? decodeURIComponent(params.hypervisor) : '';
  const { 
    hosts, 
    addHost, 
    updateHost, 
    deleteHost,
    vms,
    fetchVmsForHost,
    isFetchingVms,
  } = useAppContext();
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);

  const handleEditHost = (id: string) => {
    const hostToEdit = hosts.find((host) => host.id === id);
    if (hostToEdit) {
      setEditingHost(hostToEdit);
    }
  };

  const handleViewVms = (id: string) => {
    const hostToShow = hosts.find((host) => host.id === id);
    if (hostToShow) {
        setSelectedHost(hostToShow);
        fetchVmsForHost(hostToShow.id);
    }
  };
  
  const hypervisorName = hypervisor.charAt(0).toUpperCase() + hypervisor.slice(1);

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            {hypervisorName} Hosts
          </h1>
          <p className="text-muted-foreground">
            Manage your {hypervisorName} hypervisor hosts.
          </p>
        </div>
        <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Add New Host</CardTitle>
              <CardDescription>
                Add a new {hypervisorName} host to manage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddHostForm onAddHost={addHost} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Managed Hosts</CardTitle>
              <CardDescription>
                View, edit, or delete your added {hypervisorName} hosts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HostsTable 
                hosts={hosts} 
                onEditHost={handleEditHost}
                onViewVms={handleViewVms}
                onDeleteHost={deleteHost}
              />
            </CardContent>
          </Card>
          {selectedHost && (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Virtual Machines (Host: {selectedHost.ipAddress})</CardTitle>
                    <CardDescription>
                        Select VMs to create a migration wave.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <VmsTable vms={vms} isLoading={isFetchingVms} />
                </CardContent>
            </Card>
          )}
        </div>
      </div>
      {editingHost && (
        <EditHostDialog
          host={editingHost}
          onOpenChange={(isOpen) => !isOpen && setEditingHost(null)}
          onUpdateHost={updateHost}
        />
      )}
    </>
  );
}
