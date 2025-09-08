
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Server,
  Waypoints,
  ChevronDown,
  Target,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VmeLogo } from "@/components/icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "../ui/button";

const menuItems = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    subItems: [
      { href: "/overview", label: "Dashboards" },
    ],
  },
  {
    label: "Migration",
    icon: Waypoints,
    subItems: [
      { 
        label: "Source",
        subItems: [
            { href: "/overview/hypervisors", label: "Hypervisors" }
        ]
      },
      { href: "/migration/target", label: "Target" },
      { href: "/migration/wave", label: "Wave" },
      { href: "/migration/import", label: "Import" },
      { href: "/migration/export", label: "Export" },
    ],
  },
  {
    label: "Administration",
    icon: Server,
    subItems: [
        { href: "/administration/settings", label: "Settings" },
    ]
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [activeAccordion, setActiveAccordion] = useState<string | undefined>();
  const [activeSubAccordion, setActiveSubAccordion] = useState<string | undefined>();

  const isParentActive = (subItems: any[]) => {
    return subItems.some((subItem) => {
        if (subItem.href) {
            return pathname.startsWith(subItem.href);
        }
        if (subItem.subItems) {
            return isParentActive(subItem.subItems);
        }
        return false;
    });
  };
  
  useEffect(() => {
    const activeParent = menuItems.find(item => item.subItems && isParentActive(item.subItems));
    setActiveAccordion(activeParent?.label);

    if(activeParent?.subItems) {
        const activeSubParent = activeParent.subItems.find(item => item.subItems && isParentActive(item.subItems));
        setActiveSubAccordion(activeSubParent?.label);
    }

  }, [pathname]);


  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
            <VmeLogo className="h-6 w-6 text-primary" />
            <span>VME Migrate</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="grid items-start px-4 text-sm font-medium">
            {menuItems.map((item) =>
              item.subItems ? (
                <Accordion type="single" collapsible key={item.label} className="w-full" value={activeAccordion} onValueChange={setActiveAccordion}>
                  <AccordionItem value={item.label} className="border-b-0">
                    <AccordionTrigger 
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:text-primary hover:no-underline",
                        isParentActive(item.subItems) && "text-primary"
                      )}
                    >
                       <item.icon className="h-4 w-4" />
                       {item.label}
                    </AccordionTrigger>
                    <AccordionContent className="pl-4">
                       {item.subItems.map((subItem, index) => (
                        subItem.subItems ? (
                           <Accordion type="single" collapsible key={subItem.label} className="w-full" value={activeSubAccordion} onValueChange={setActiveSubAccordion}>
                             <AccordionItem value={subItem.label} className="border-b-0">
                               <AccordionTrigger 
                                 className={cn(
                                   "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:text-primary hover:no-underline",
                                   isParentActive(subItem.subItems) && "text-primary"
                                 )}
                               >
                                  {subItem.label}
                               </AccordionTrigger>
                               <AccordionContent className="pl-8">
                                  {subItem.subItems.map((nestedItem) => (
                                     <Link
                                      key={nestedItem.href}
                                      href={nestedItem.href}
                                      className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:text-primary",
                                        pathname === nestedItem.href && "text-primary bg-muted"
                                      )}
                                    >
                                      {nestedItem.label}
                                    </Link>
                                  ))}
                               </AccordionContent>
                             </AccordionItem>
                           </Accordion>
                        ) : (
                            subItem.href && (
                                <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:text-primary",
                                        pathname === subItem.href && "text-primary bg-muted"
                                    )}
                                >
                                {subItem.label}
                                </Link>
                            )
                        )
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                item.href && (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-card-foreground transition-all hover:text-primary",
                      pathname === item.href && "bg-muted text-primary"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              )
            )}
          </nav>
        </div>
      </div>
  );
}
