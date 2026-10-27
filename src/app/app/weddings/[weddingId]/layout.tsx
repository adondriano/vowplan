import { requireWeddingAccess, listWeddingsForUser } from "@/lib/server/weddings";
import { PlannerSidebar } from "@/components/planner/sidebar";
import { formatDate, coupleNames } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function WeddingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const access = await requireWeddingAccess(weddingId);
  const { weddings } = await listWeddingsForUser();

  return (
    <div className="flex min-h-dvh">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <PlannerSidebar
        weddingId={weddingId}
        weddingName={coupleNames(access.wedding)}
        dateLabel={access.wedding.wedding_date ? formatDate(access.wedding.wedding_date) : "Date not set"}
        dateTentative={access.wedding.date_status === "tentative"}
        otherWeddings={weddings
          .filter((w) => w.id !== weddingId)
          .map((w) => ({ id: w.id, name: [w.bride_name, w.groom_name].filter(Boolean).join(" & ") || "Untitled wedding" }))}
      />
      <div className="min-w-0 flex-1">
        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
