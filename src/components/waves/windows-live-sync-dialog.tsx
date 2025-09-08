
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

type WindowsLiveSyncDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vm: VirtualMachine;
  waveId: string;
};

export function WindowsLiveSyncDialog({ isOpen, onOpenChange, vm, waveId }: WindowsLiveSyncDialogProps) {
  const { updateVmInWave, startWindowsLiveSync, getLiveSyncLogs } = useAppContext();
  const { toast } = useToast();
  const [targetIp, setTargetIp] = useState(vm.liveSyncTargetIp || "");
  const [username, setUsername] = useState(vm.liveSyncUsername || "");
  const [password, setPassword] = useState(vm.liveSyncPassword || "");
  const [logs, setLogs] = useState(vm.liveSyncLogs || `Awaiting action for ${vm.name}...`);
  const [isSyncing, setIsSyncing] = useState(false);
  const [runningAction, setRunningAction] = useState<"start" | "stop" | "logs" | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const isActionRunning = !!runningAction;

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
        }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    if (isOpen) {
        setTargetIp(vm.liveSyncTargetIp || "");
        setUsername(vm.liveSyncUsername || "");
        setPassword(vm.liveSyncPassword || "");
        setLogs(vm.liveSyncLogs || `Awaiting action for ${vm.name}...`);
        setIsSyncing(vm.liveSyncStatus === 'syncing');
    } else {
        setIsSyncing(false);
    }
  }, [isOpen, vm]);

  const handleAction = async (action: 'start' | 'stop' | 'logs') => {
    setRunningAction(action);
    setLogs(prev => `${prev}\n\n[${new Date().toLocaleTimeString()}] Executing: ${action}`);

    if (action === 'start') {
        const creds = { liveSyncTargetIp: targetIp, liveSyncUsername: username, liveSyncPassword: password };
        updateVmInWave(waveId, vm.id, creds);

        const result = await startWindowsLiveSync(vm, creds);
        if (result) {
            toast({ title: `Sync process initiated` });
            setLogs(`[${new Date().toLocaleTimeString()}] Windows sync process initiated for ${vm.ipAddress} -> ${targetIp}.\nBackend logs will contain detailed progress.\nUse "Check Logs" to manually fetch the latest output.`);
            setIsSyncing(true);
            updateVmInWave(waveId, vm.id, { liveSyncStatus: 'syncing' });
        } else {
            setLogs(prev => `${prev}\n\n[${new Date().toLocaleTimeString()}] Failed to start sync process.`);
            updateVmInWave(waveId, vm.id, { liveSyncStatus: 'error' });
        }
    } else if (action === 'stop') {
        setIsSyncing(false);
        updateVmInWave(waveId, vm.id, { liveSyncStatus: 'ready' });
        setLogs(prev => `${prev}\n\n[${new Date().toLocaleTimeString()}] Sync stopped.`);
        toast({ title: 'Sync Stopped', description: 'Live sync has been stopped.' });
    } else if (action === 'logs') {
        if (!vm.ipAddress || !targetIp) {
            toast({ title: "Cannot fetch logs", description: "Source and Target IP must be set.", variant: "destructive"});
        } else {
            const result = await getLiveSyncLogs(vm.ipAddress, targetIp, 'windows');
            if (result) {
                setLogs(result.logs);
            } else {
                setLogs(prev => `${prev}\n\n[${new Date().toLocaleTimeString()}] Could not fetch logs.`);
            }
            toast({ title: 'Logs Refreshed' });
        }
    }
    
    setRunningAction(null);
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Windows Live Sync for: {vm.name}</DialogTitle>
          <DialogDescription>
            Manage real-time replication for this Windows VM. Source IP: {vm.ipAddress}
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
                placeholder="e.g., 192.168.1.101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., Administrator"
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
                <Button onClick={() => handleAction("start")} disabled={!targetIp || !username || !password || isSyncing || isActionRunning}>
                  {isActionRunning && runningAction === 'start' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSyncing ? "Syncing..." : "Start Live Sync"}
                </Button>
                <Button onClick={() => handleAction("stop")} variant="destructive" disabled={!isSyncing || isActionRunning}>
                  {isActionRunning && runningAction === 'stop' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Stop Sync
                </Button>
                <Button onClick={() => handleAction("logs")} variant="outline" className="col-span-2" disabled={isActionRunning}>
                  {isActionRunning && runningAction === 'logs' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
