"use client";
import * as DialogPrimitive from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Dialog = DialogPrimitive.Dialog.Root;
export const DialogTrigger = DialogPrimitive.Dialog.Trigger;
export const DialogClose = DialogPrimitive.Dialog.Close;

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Dialog.Content> & { wide?: boolean }
>(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Dialog.Portal>
    <DialogPrimitive.Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] data-[state=open]:animate-scale-in" />
    <DialogPrimitive.Dialog.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl animate-scale-in thin-scroll",
        wide ? "max-w-2xl" : "max-w-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Dialog.Close
        aria-label="Close dialog"
        className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-warm hover:text-foreground cursor-pointer"
      >
        <X className="size-4" aria-hidden="true" />
      </DialogPrimitive.Dialog.Close>
    </DialogPrimitive.Dialog.Content>
  </DialogPrimitive.Dialog.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4 pr-8">
      <DialogPrimitive.Dialog.Title className="font-display text-xl font-semibold text-foreground">
        {title}
      </DialogPrimitive.Dialog.Title>
      {description && (
        <DialogPrimitive.Dialog.Description className="mt-1 text-sm text-muted-foreground">
          {description}
        </DialogPrimitive.Dialog.Description>
      )}
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>;
}
