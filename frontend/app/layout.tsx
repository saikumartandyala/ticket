import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "../components/site/AppShell";
import { THEME_SCRIPT } from "../lib/theme";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TickOrbit — Every ticket deserves a destination",
    template: "%s · TickOrbit",
  },
  description:
    "A peer-to-peer marketplace for last-minute train, bus, match and concert tickets in India. Free to list, no fees, fair prices.",
  keywords: ["ticket transfer", "P2P resale", "train ticket", "bus ticket", "IPL tickets", "concert tickets", "India"],
  openGraph: {
    title: "TickOrbit",
    description: "Every ticket deserves a destination. Pass on train, bus, match and concert tickets you can't use.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#10100d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
