import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/Navbar";
import FieldCanvas from "../components/FieldCanvas";

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
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#050308", minHeight: "100vh", position: "relative" }}>
        <FieldCanvas />
        <div style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Navbar />
          <main style={{ flexGrow: 1, position: "relative" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
