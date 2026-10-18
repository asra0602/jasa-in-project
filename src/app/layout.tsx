import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jasa-in — Marketplace Jasa Digital",
  description: "Temukan jasa digital dari seller independen di Jasa-in.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
