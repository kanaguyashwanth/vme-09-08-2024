
"use client";

import { useMemo } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Waves, Server, CheckCircle, ChevronsRight } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

export default function OverviewPage() {
  const { waves } = useAppContext();

  const totalVms = useMemo(() => {
    return waves.reduce((acc, wave) => acc + wave.vms.length, 0);
  }, [waves]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          A high-level overview of your migration progress.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Waves" value={waves.length.toString()} icon={Waves} />
        <StatCard title="VMs" value={totalVms.toString()} icon={Server} />
        <StatCard title="Completed Waves" value="0" icon={CheckCircle} />
        <StatCard title="Migrated VMs" value="0" icon={ChevronsRight} />
      </div>
    </div>
  );
}
