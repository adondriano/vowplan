"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptWorkspaceInvite, declineWorkspaceInvite } from "@/lib/actions/directory";

export function AcceptInviteButtons({ weddingId }: { weddingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    await acceptWorkspaceInvite(weddingId);
    setBusy(false);
    router.push(`/app/weddings/${weddingId}`);
    router.refresh();
  }
  async function decline() {
    setBusy(true);
    await declineWorkspaceInvite(weddingId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={accept} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Accept invite
      </Button>
      <Button size="sm" variant="outline" onClick={decline} disabled={busy}>
        Decline
      </Button>
    </div>
  );
}
