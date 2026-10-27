"use client";
import * as SwitchPrimitive from "radix-ui";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Switch.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Switch.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Switch.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Switch.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Switch.Root>
));
Switch.displayName = "Switch";
