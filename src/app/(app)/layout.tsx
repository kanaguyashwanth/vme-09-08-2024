
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { AppProvider } from "@/context/AppContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar>
            <AppSidebar />
          </Sidebar>
          <div className="flex flex-1 flex-col">
            <AppHeader />
            <SidebarInset>
              <div className="p-4 sm:p-6 lg:p-8">{children}</div>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </AppProvider>
  );
}
