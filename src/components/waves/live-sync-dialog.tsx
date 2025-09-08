
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VirtualMachine } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type LiveSyncDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vm: VirtualMachine;
  waveId: string;
};

export function LiveSyncDialog({ isOpen, onOpenChange, vm, waveId }: LiveSyncDialogProps) {
  const { updateVmInWave, liveSyncAction, getLiveSyncLogs } = useAppContext();
  const { toast } = useToast();
  const [targetIp, setTargetIp] = useState(vm.liveSyncTargetIp || "");
  const [username, setUsername] = useState(vm.liveSyncUsername || "");
  const [password, setPassword] = useState(vm.liveSyncPassword || "");
  const [logs, setLogs] = useState(vm.liveSyncLogs || `Awaiting action for ${vm.name}...`);
  const [isPolling, setIsPolling] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);


  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
        }
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!vm.ipAddress || !targetIp) return;
    const result = await getLiveSyncLogs(vm.ipAddress, targetIp, 'linux');
    if (result) {
        setLogs(result.logs);
    }
  }, [vm.ipAddress, targetIp, getLiveSyncLogs]);

  useEffect(() => {
    if (isPolling) {
        pollingIntervalRef.current = setInterval(fetchLogs, 3000);
    } else {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
    }
    return () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
    };
  }, [isPolling, fetchLogs]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    if (isOpen) {
        setTargetIp(vm.liveSyncTargetIp || "");
        setUsername(vm.liveSyncUsername || "");
        setPassword(vm.liveSyncPassword || "");
        setLogs(vm.liveSyncLogs || `Awaiting action for ${vm.name}...`);
        
        if(vm.liveSyncStatus === 'syncing') {
            setIsPolling(true);
        }
    } else {
        setIsPolling(false);
    }
  }, [isOpen, vm]);

  const handleAction = async (action: "start" | "stop" | "logs") => {
    setIsActionRunning(true);
    const actionText = {
      start: "Starting live synchronization...",
      stop: "Stopping live synchronization...",
      logs: "Fetching latest logs...",
    };

    setLogs(prev => `${prev}\n\n[${new Date().toLocaleTimeString()}] Executing: ${action}\n${actionText[action]}`);
    
    // Persist credentials before making the call
    const creds = { liveSyncTargetIp: targetIp, liveSyncUsername: username, liveSyncPassword: password };
    updateVmInWave(waveId, vm.id, creds);

    const result = await liveSyncAction(action, vm, creds);

    if (result) {
        toast({ title: `Action '${action}' initiated` });
        if (action === 'start') {
            setIsPolling(true);
            updateVmInWave(waveId, vm.id, { liveSyncStatus: 'syncing' });
        } else if (action === 'stop') {
            setIsPolling(false);
            updateVmInWave(waveId, vm.id, { liveSyncStatus: 'ready' });
        }
        await fetchLogs();
    }
    setIsActionRunning(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Live Sync for: {vm.name}</DialogTitle>
          <DialogDescription>
            Manage real-time replication for this VM. Source IP: {vm.ipAddress}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <h3 className="font-semibold">Target VM Credentials</h3>
            <div className="space-y-2">
              <Label htmlFor="target-ip">Target IP Address</Label>
              <Input
                id="target-ip"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
                placeholder="e.g., 192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., root"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-4">
                <Button onClick={() => handleAction("start")} disabled={!targetIp || !username || !password || isPolling || isActionRunning}>
                  {isActionRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPolling ? "Syncing..." : "Start Live Sync"}
                </Button>
                <Button onClick={() => handleAction("stop")} variant="destructive" disabled={!isPolling || isActionRunning}>
                  {isActionRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Stop Sync
                </Button>
                <Button onClick={() => handleAction("logs")} variant="outline" className="col-span-2" disabled={isActionRunning}>
                  {isActionRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Check Logs
                </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logs</Label>
            <ScrollArea className="h-72 w-full rounded-md border bg-muted p-4" ref={scrollAreaRef}>
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {logs}
              </pre>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
