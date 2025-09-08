
"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Host, HostWithPassword } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  ipAddress: z.string().ip({ message: "Please enter a valid IP address." }),
  username: z.string().min(1, { message: "Username cannot be empty." }),
  password: z.string().optional(),
  morpheusFqdn: z.string().optional(),
  morpheusApiKey: z.string().optional(),
});

type EditHostFormValues = z.infer<typeof formSchema>;

type EditHostDialogProps = {
  host: Host;
  onOpenChange: (open: boolean) => void;
  onUpdateHost: (updatedHost: HostWithPassword) => void;
};

export function EditHostDialog({ host, onOpenChange, onUpdateHost }: EditHostDialogProps) {
  const form = useForm<EditHostFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ipAddress: host.ipAddress,
      username: host.username,
      password: "",
      morpheusFqdn: host.morpheusFqdn || "",
      morpheusApiKey: "",
    },
  });

  useEffect(() => {
    form.reset({
        ipAddress: host.ipAddress,
        username: host.username,
        password: "",
        morpheusFqdn: host.morpheusFqdn || "",
        morpheusApiKey: "",
    })
  }, [host, form]);

  function onSubmit(values: EditHostFormValues) {
    onUpdateHost({ 
      id: host.id, 
      ipAddress: values.ipAddress, 
      username: values.username,
      password: values.password || undefined,
      morpheusFqdn: values.morpheusFqdn,
      morpheusApiKey: values.morpheusApiKey || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Host</DialogTitle>
          <DialogDescription>
            Update the details for host {host.ipAddress}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ipAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 192.168.1.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Leave blank to keep current" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="morpheusFqdn"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Morpheus FQDN</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., morpheus.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="md:col-span-2">
                    <FormField
                        control={form.control}
                        name="morpheusApiKey"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>New Morpheus API Key</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="Leave blank to keep current key" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
