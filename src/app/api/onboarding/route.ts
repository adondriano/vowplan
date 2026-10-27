import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createWeddingWorkspace, type OnboardingInput } from "@/lib/server/weddings";

/** Creates the wedding workspace for the signed-in user (onboarding step 4). */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Partial<OnboardingInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.brideName?.trim() || !body.groomName?.trim()) {
    return NextResponse.json({ error: "Both partner names are required" }, { status: 400 });
  }
  const dateStatus = body.dateStatus === "confirmed" ? "confirmed" : body.dateStatus === "tentative" ? "tentative" : "undecided";
  if (dateStatus !== "undecided" && !body.weddingDate) {
    return NextResponse.json({ error: "A wedding date is required unless you choose 'not set yet'" }, { status: 400 });
  }

  try {
    // Ensure a profile row exists for the new user.
    const { error: perr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: body.brideName?.trim() ?? null }, { onConflict: "id" });
    if (perr) throw new Error(perr.message);

    const wedding = await createWeddingWorkspace({
      brideName: body.brideName.trim(),
      groomName: body.groomName.trim(),
      partner1Label: body.partner1Label,
      partner2Label: body.partner2Label,
      weddingDate: body.weddingDate ?? null,
      dateStatus,
      location: body.location ?? null,
      currency: body.currency || "PHP",
      guestCountEstimate: body.guestCountEstimate ?? null,
      totalBudget: body.totalBudget ?? null,
      weddingStyle: body.weddingStyle ?? null,
      rsvpDeadline: body.rsvpDeadline ?? null,
      createDefaults: body.createDefaults !== false,
    });
    return NextResponse.json({ weddingId: wedding.id });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
