import { requireWeddingAccess } from "@/lib/server/weddings";
import { requireUser } from "@/lib/server/weddings";
import { createServerClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/planner/settings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const [{ wedding, role, members }, { user }] = await Promise.all([requireWeddingAccess(weddingId), requireUser()]);
  const supabase = await createServerClient();
  const { data: profile } = await supabase.from("profiles").select("display_name, preferred_currency").eq("id", user.id).maybeSingle();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  return (
    <SettingsClient
      wedding={wedding}
      role={role}
      members={members}
      profile={{ displayName: profile?.display_name ?? "", currency: profile?.preferred_currency ?? "PHP" }}
      email={authUser?.email ?? ""}
    />
  );
}
