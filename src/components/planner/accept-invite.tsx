"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptWorkspaceInvite, declineWorkspaceInvite } from "@/lib/actions/directory";
import { useToast } from "@/components/ui/toast";

export function AcceptInviteButtons({ weddingId }: { weddingId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  async function accept() {
    setBusy("accept");
    const r = await acceptWorkspaceInvite(weddingId);
    setBusy(null);
    if ("error" in r && r.error) {
      toast("error", r.error);
      return;
    }
    toast("success", "You're in — opening the wedding dashboard.");
    router.push(`/app/weddings/${weddingId}`);
    router.refresh();
  }
  async function decline() {
    setBusy("decline");
    await declineWorkspaceInvite(weddingId);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={accept} disabled={busy !== null}>
        {busy === "accept" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Accept invite
      </Button>
      <Button size="sm" variant="outline" onClick={decline} disabled={busy !== null}>
        Decline
      </Button>
    </div>
  );
}
