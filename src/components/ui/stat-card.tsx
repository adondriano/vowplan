import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon,
  href,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const toneRing = {
    neutral: "",
    primary: "border-primary/25",
    success: "border-success/25",
    warning: "border-warning/25",
    destructive: "border-destructive/30",
  }[tone];

  const inner = (
    <div
      className={cn(
        "card flex items-start gap-3 p-4 transition-shadow hover:shadow-md",
        toneRing,
        href && "cursor-pointer",
        className,
      )}
    >
      {icon && (
        <div className="mt-0.5 rounded-lg bg-primary-soft p-2 text-primary [&_svg]:size-4" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-semibold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none">{inner}</Link> : inner;
}
