import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { Providers } from "./providers";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ShiftSync — Coastal Eats Scheduling",
  description: "Multi-location staff scheduling platform",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark font-sans", roboto.variable, robotoMono.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
        <Toaster richColors position="top-right" />
        <ScrollToTop />
      </body>
    </html>
  );
}
