import { cn } from "@/lib/utils";

export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("w-full overflow-x-auto thin-scroll", className)}>{children}</div>;
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full caption-bottom text-sm", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="[&_th]:h-10 [&_th]:px-3 [&_th]:text-left [&_th]:align-middle [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:border-b">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_tr]:border-b [&_tr:last-child]:border-0 [&_tr:hover]:bg-surface-warm/50 transition-colors">{children}</tbody>;
}

export function TR({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={className}>{children}</tr>;
}

export function TD({ className, children, colSpan }: { className?: string; children?: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className={className}>{children}</td>;
}

export function TH({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={className}>{children}</th>;
}
