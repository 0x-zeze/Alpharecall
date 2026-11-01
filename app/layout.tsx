import type { Metadata, Viewport } from "next";
import { Sora, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080B16",
};

export const metadata: Metadata = {
  title: "WalRecall — Prediction Journal & Credibility Engine",
  description: "Prediction journal and forecaster credibility engine powered by Walrus Memory and Sui Mainnet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#080B16] text-[#EDEDED] selection:bg-[#8B7CFF]/30 selection:text-[#55C9ED]">
        {children}
      </body>
    </html>
  );
}
