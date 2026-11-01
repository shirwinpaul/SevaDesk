import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Tamil } from "next/font/google";
import { UiPrefsProvider } from "@/hooks/useUiPrefs";
import { Footer } from "@/components/Footer";
import { Motion, ServiceWorker } from "@/components/Pwa";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", display: "swap" });

export const metadata: Metadata = {
  title: "SevaDesk — Toolkit for social workers",
  description: "Less paperwork. More people helped. Local-first, encrypted toolkit for social workers and community organisations.",
  applicationName: "SevaDesk",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#17645c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${tamil.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col antialiased">
        <UiPrefsProvider>
          <Motion>
            <ServiceWorker />
            <div className="flex-1">{children}</div>
            <Footer />
          </Motion>
        </UiPrefsProvider>
      </body>
    </html>
  );
}
