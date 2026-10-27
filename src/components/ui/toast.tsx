"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; kind: "success" | "error" | "info"; message: string };
type ToastContextValue = {
  toast: (kind: Toast["kind"], message: string) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const toast = useCallback((kind: Toast["kind"], message: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3.5 text-sm shadow-lg animate-toast-in bg-surface",
              t.kind === "success" && "border-success/30",
              t.kind === "error" && "border-destructive/30",
              t.kind === "info" && "border-info/30",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
            {t.kind === "error" && <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />}
            {t.kind === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />}
            <span className="text-foreground">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
