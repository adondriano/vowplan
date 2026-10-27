"use client";
import * as TabsPrimitive from "radix-ui";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Tabs = TabsPrimitive.Tabs.Root;

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Tabs.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tabs.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Tabs.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-xl border border-border bg-surface-warm/60 p-1 overflow-x-auto thin-scroll max-w-full",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Tabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tabs.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Tabs.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors cursor-pointer data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-sm hover:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Tabs.Content;
