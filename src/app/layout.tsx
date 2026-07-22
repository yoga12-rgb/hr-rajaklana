import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
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
      <body className="min-h-full bg-slate-950 text-slate-100 flex flex-row font-sans">
        <HRProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 md:pb-0 bg-slate-950">
            <Header />
            <main className="flex-1 p-4 sm:p-6 max-w-lg md:max-w-7xl mx-auto w-full">
              {children}
            </main>
            <BottomNav />
          </div>
        </HRProvider>
      </body>
    </html>
  );
}
