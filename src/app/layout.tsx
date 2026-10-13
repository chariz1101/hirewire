import type { Metadata } from "next";
import { Onest, Red_Hat_Mono } from "next/font/google";
import "./globals.css";

// Onest: clean grotesque, loaded from 400 up so text never renders thin
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Red Hat Mono: sturdy monospace for labels and buttons
const redHatMono = Red_Hat_Mono({
  variable: "--font-red-hat-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HireWire | Automated Application Tracker",
  description: "An automated job and OJT application tracker that syncs directly with your inbox to detect employer replies and reminds you when to follow up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${onest.variable} ${redHatMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}