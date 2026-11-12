import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisCart — Autonomous Commerce & Verified PayPal Checkout",
  description:
    "Structured hardware procurement agent with deterministic spend policy enforcement and PayPal Orders v2 checkout verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-zinc-50 text-zinc-900 min-h-screen selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
