
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { HostWithPassword } from "@/types";

const formSchema = z.object({
  ipAddress: z.string().ip({ message: "Please enter a valid IP address." }),
  username: z.string().min(1, { message: "Username cannot be empty." }),
  password: z.string().min(1, { message: "Password cannot be empty." }),
  morpheusFqdn: z.string().optional(),
  morpheusApiKey: z.string().optional(),
});

type AddHostFormValues = z.infer<typeof formSchema>;

type AddHostFormProps = {
    onAddHost: (host: Omit<HostWithPassword, "id">) => boolean;
}

export function AddHostForm({ onAddHost }: AddHostFormProps) {
  const form = useForm<AddHostFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ipAddress: "",
      username: "",
      password: "",
      morpheusFqdn: "",
      morpheusApiKey: "",
    },
  });

  function onSubmit(values: AddHostFormValues) {
    const wasAdded = onAddHost(values);
    
    if (wasAdded) {
      form.reset();
    }
  }

  return (
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
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
            <FormField
                control={form.control}
                name="morpheusApiKey"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Morpheus API Key</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="Paste API key here" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <Button type="submit" className="w-full">Add Host</Button>
      </form>
    </Form>
  );
}
