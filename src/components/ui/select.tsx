"use client";
import * as SelectPrimitive from "radix-ui";

const S = SelectPrimitive.Select;
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Select = S.Select;
export const SelectValue = S.SelectValue;
export const SelectGroup = S.SelectGroup;

export const SelectTrigger = forwardRef<
  React.ElementRef<typeof S.SelectTrigger>,
  React.ComponentPropsWithoutRef<typeof S.SelectTrigger>
>(({ className, children, ...props }, ref) => (
  <S.SelectTrigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate",
      className,
    )}
    {...props}
  >
    {children}
    <S.SelectIcon asChild>
      <ChevronDown className="size-4 opacity-50 shrink-0" aria-hidden="true" />
    </S.SelectIcon>
  </S.SelectTrigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  React.ElementRef<typeof S.SelectContent>,
  React.ComponentPropsWithoutRef<typeof S.SelectContent>
>(({ className, children, position = "popper", ...props }, ref) => (
  <S.SelectPortal>
    <S.SelectContent
      ref={ref}
      position={position}
      className={cn(
        "z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-scale-in",
        position === "popper" && "w-[var(--radix-select-trigger-width)]",
        className,
      )}
      {...props}
    >
      <S.SelectViewport className="p-1 thin-scroll">
        {children}
      </S.SelectViewport>
    </S.SelectContent>
  </S.SelectPortal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  React.ElementRef<typeof S.SelectItem>,
  React.ComponentPropsWithoutRef<typeof S.SelectItem>
>(({ className, children, ...props }, ref) => (
  <S.SelectItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <S.ItemIndicator>
        <Check className="size-4" aria-hidden="true" />
      </S.ItemIndicator>
    </span>
    <S.ItemText>{children}</S.ItemText>
  </S.SelectItem>
));
SelectItem.displayName = "SelectItem";
