import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
        {/* Add this script tag to load Tailwind CSS from the CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className={`${inter.className} min-h-screen flex items-center justify-center`}>
        {children}
      </body>
    </html>
  );
}