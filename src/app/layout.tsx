import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trend Genius Calculator",
  description: "Calculate ON/OFF thresholds for X Trend Genius ad triggers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-foreground">
        <header className="border-b border-x-border px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current" aria-label="X">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <h1 className="text-lg font-bold text-white">Trend Genius Calculator</h1>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
