import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/src/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Sunday Ledger — Payroll & Attendance Management",
  description: "Authentic ledger payroll system powered by the Sunday rule engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
