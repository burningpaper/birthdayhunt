import type { Metadata } from "next";
import { Lilita_One, Outfit } from "next/font/google";
import "./globals.css";

const lilita = Lilita_One({
  variable: "--font-lilita",
  weight: "400",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Treasure Hunt",
  description: "A QR-code treasure hunt around the house.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${lilita.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
