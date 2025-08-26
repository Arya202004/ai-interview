import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script"; // 1. Import the Script component
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Interview Assistant",
  description: "Your personal real-time interview coach",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 2. Use the Script component for Tailwind CDN */}
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body className={`${inter.className} min-h-screen flex items-center justify-center`}>
        {children}
      </body>
    </html>
  );
}