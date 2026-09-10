import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "LastMinutePass — P2P Ticket Resale Marketplace",
  description: "The ultimate Indian P2P ticket resale marketplace. Safely transfer last-minute train, bus, IPL, and concert tickets at fair prices without expensive cancellation fees.",
  keywords: ["ticket transfer", "P2P resale", "Indian trains ticket", "bus ticket transfer", "IPL ticket resale", "last minute travel"],
  openGraph: {
    title: "LastMinutePass — P2P Ticket Resale Marketplace",
    description: "Transfer last-minute train, bus, and event tickets at fair prices directly between peers.",
    type: "website",
    locale: "en_IN"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Instrument+Sans:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#050308", minHeight: "100vh", position: "relative" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
