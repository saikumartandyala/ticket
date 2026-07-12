import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/Navbar";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans"
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display"
});

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
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-[#030510] text-[#f0f4ff] font-sans antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow relative">
          {children}
        </main>
      </body>
    </html>
  );
}
