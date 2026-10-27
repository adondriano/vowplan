import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function formatMoney(amount: number | null | undefined, currency = "PHP"): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function formatCompactMoney(amount: number, currency = "PHP"): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      notation: Math.abs(amount) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(amount) >= 1_000_000 ? 1 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

export function formatDate(d: string | Date | null | undefined, pattern = "MMMM d, yyyy"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

export function daysUntil(dateStr: string | null | undefined, from: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function countdownLabel(dateStr: string | null | undefined): string | null {
  const days = daysUntil(dateStr);
  if (days == null) return null;
  if (days > 1) return `${days.toLocaleString()} days to go`;
  if (days === 1) return "Tomorrow!";
  if (days === 0) return "Today!";
  if (days === -1) return "Yesterday";
  return `${Math.abs(days).toLocaleString()} days ago`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    return `${formatDistanceToNowStrict(d)} ago`;
  } catch {
    return "—";
  }
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export function coupleNames(w: {
  bride_name: string;
  groom_name: string;
}): string {
  return [w.bride_name, w.groom_name].filter(Boolean).join(" & ") || "Your Wedding";
}
