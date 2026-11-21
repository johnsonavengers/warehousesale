import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { EVENT } from "@/config/event";
import { hexToRgbTriple } from "@/lib/color";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: EVENT.name, template: `%s · ${EVENT.name}` },
  description: EVENT.tagline,
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  // Agar env(safe-area-inset-*) terisi di iPhone berponi / home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vars = {
    "--primary": hexToRgbTriple(EVENT.primaryColor),
    "--primary-fg": hexToRgbTriple(EVENT.primaryTextColor),
  } as React.CSSProperties;
  return (
    <html lang="id" style={vars}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
