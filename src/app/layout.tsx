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

export const viewport: Viewport = { themeColor: "#0d0b14", width: "device-width", initialScale: 1 };

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
