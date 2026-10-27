import { playfair, dancing, ebGaramond } from "@/lib/fonts";

export const metadata = {
  title: "Wedding Invitation",
  robots: { index: false, follow: false }, // personalized pages must not be indexed
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} ${dancing.variable} ${ebGaramond.variable}`}>
      {children}
    </div>
  );
}
