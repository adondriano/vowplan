import type { Metadata } from "next";
import { inter, cormorant, vibes } from "@/lib/fonts";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VowPlan — Wedding Planner", template: "%s · VowPlan" },
  description:
    "Plan your wedding end-to-end: guests, RSVPs, digital invitations, budget, vendors, seating, and a beautiful public invitation website.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cormorant.variable} ${vibes.variable} font-sans min-h-dvh antialiased`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
