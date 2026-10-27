import { MailX } from "lucide-react";

/** Graceful, non-revealing error page for invalid/revoked/expired links. */
export function InvalidToken({ kind }: { kind?: string }) {
  const message =
    kind === "revoked"
      ? "This invitation link is no longer active. Please ask the couple for an updated link."
      : kind === "expired"
        ? "This invitation link has expired. Please ask the couple for a new link."
        : "We couldn't find this invitation. Please double-check the link, or ask the couple to resend it.";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FDF4F1] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#E8DFD8] bg-white p-8 text-center shadow-sm">
        <MailX className="mx-auto size-10 text-[#9D2C4E]" aria-hidden="true" />
        <h1 className="mt-4 font-[var(--font-cormorant)] text-2xl font-semibold text-[#3B2A2E]">
          Invitation unavailable
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8A777C]">{message}</p>
        <p className="mt-6 font-[var(--font-vibes)] text-2xl text-[#9D2C4E]">with love</p>
      </div>
    </main>
  );
}
