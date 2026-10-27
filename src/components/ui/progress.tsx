import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "primary",
  label,
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const toneBg = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-warm", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", toneBg)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
