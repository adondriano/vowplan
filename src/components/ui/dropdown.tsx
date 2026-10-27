"use client";
import * as DropdownPrimitive from "radix-ui";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const DropdownMenu = DropdownPrimitive.DropdownMenu.Root;
export const DropdownMenuTrigger = DropdownPrimitive.DropdownMenu.Trigger;

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownPrimitive.DropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.DropdownMenu.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownPrimitive.DropdownMenu.Portal>
    <DropdownPrimitive.DropdownMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg animate-scale-in",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.DropdownMenu.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownPrimitive.DropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.DropdownMenu.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownPrimitive.DropdownMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-primary-soft [&_svg]:size-4 [&_svg]:shrink-0",
      destructive && "text-destructive data-[highlighted]:bg-destructive-soft",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}
