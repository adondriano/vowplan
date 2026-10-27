"use client";
import * as CheckboxPrimitive from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Checkbox.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Checkbox.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Checkbox.Root
    ref={ref}
    className={cn(
      "peer size-[18px] shrink-0 rounded border border-border-strong bg-surface cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Checkbox.Indicator className="flex items-center justify-center text-white">
      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
    </CheckboxPrimitive.Checkbox.Indicator>
  </CheckboxPrimitive.Checkbox.Root>
));
Checkbox.displayName = "Checkbox";
