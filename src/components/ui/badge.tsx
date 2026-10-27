import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-warm text-foreground-secondary border-border",
  primary: "bg-primary-soft text-primary border-primary/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  destructive: "bg-destructive-soft text-destructive border-destructive/20",
  info: "bg-info-soft text-info border-info/20",
  gold: "bg-accent-soft text-accent border-accent/20",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
  icon,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
