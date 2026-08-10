import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDP Mafia — The Fastest Way to Build a KDP Business",
  description:
    "Research niches, create books, generate covers, package for Amazon KDP, and scale your publishing business from one platform.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
