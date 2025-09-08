"use client";

import { useRouter } from "next/navigation";
import { Cloud, Laptop } from "lucide-react";
import { Vmware, Redhat } from "@/components/icons";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const hypervisors = [
  {
    name: "VMware",
    icon: Vmware,
    href: "/overview/hypervisors/vmware",
  },
  {
    name: "OpenStack",
    icon: Cloud,
    href: "/overview/hypervisors/openstack",
  },
  {
    name: "OpenShift",
    icon: Redhat,
    href: "/overview/hypervisors/openshift",
  },
  {
    name: "Hyper-V",
    icon: Laptop,
    href: "/overview/hypervisors/hyperv",
  },
];

export default function HypervisorsPage() {
  return (
    <div className="flex flex-col gap-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Select a Hypervisor
        </h1>
        <p className="text-muted-foreground">
          Choose a vendor to add and manage your hosts.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {hypervisors.map((hypervisor) => (
          <Link href={hypervisor.href} key={hypervisor.name}>
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-2xl font-bold">{hypervisor.name}</CardTitle>
                    <hypervisor.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
