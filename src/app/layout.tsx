import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { HRProvider } from "@/context/HRContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HR Rajaklana - Mobile Portal SDM",
  description: "Sistem Informasi Manajemen SDM Mobile Rajaklana Group",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HR Rajaklana",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full w-full flex-row bg-slate-950 font-sans text-slate-100">
        <HRProvider>
          <AppShell>{children}</AppShell>
        </HRProvider>
      </body>
    </html>
  );
}
