

export type Host = {
  id: string;
  ipAddress: string;
  username: string;
  morpheusFqdn?: string;
  morpheusApiKey?: string;
};

export type HostWithPassword = Host & {
  password?: string;
}

export type StageStatus = "success" | "failure" | "pending" | "running";

export type Stage = {
    name: string;
    status: StageStatus;
    content?: any;
};


export type VirtualMachine = {
  id: string;
  name: string;
  powerState: "poweredOn" | "poweredOff" | "suspended" | "not present";
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  ipAddress: string;
  hostname: string;
  guestOs?: string;
  osType?: 'Windows' | 'Linux' | 'Unknown';
  hostId: string;
  targetName?: string;
  cloneTaskId?: string;
  cloneProgress?: number;
  cloneStatus?: "pending" | "running" | "success" | "error";
  cloneName?: string;
  preparationStatus?: "pending" | "running" | "success" | "error";
  preparationLogs?: any;
  migrationStatus?: "pending" | "running" | "success" | "error";
  migrationLogs?: any;
  migrationProgress?: number;
  liveSyncStatus?: "idle" | "checking" | "ready" | "syncing" | "error";
  liveSyncTargetIp?: string;
  liveSyncUsername?: string;
  liveSyncPassword?: string;
  liveSyncLogs?: string;
  morpheusAgentStatus?: "pending" | "running" | "success" | "failed";
  pingStatus?: "pending" | "success" | "failed";
  sourceFileCount?: number;
  targetFileCount?: number;
  sourceChkdskReport?: Record<string, string[]>;
  targetChkdskReport?: Record<string, string[]>;
  ipReassignmentStatus?: "pending" | "running" | "success" | "failed";
  newTargetIp?: string;
  ipReassignmentLogs?: string;
};

export type MigrationWave = {
  id: string;
  name: string;
  vms: VirtualMachine[];
  createdAt: Date;
  stages?: Stage[];
};
