"use client";
import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  htmlFor,
  hint,
  required,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-medium text-foreground", className)}>
      {children}
      {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      {hint && <span className="ml-2 font-normal text-muted-foreground text-xs">{hint}</span>}
    </label>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}
