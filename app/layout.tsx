import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

/** The one typeface: made for public-service software, with figures that line up in columns. */
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Sentinel",
    template: "%s · Sentinel",
  },
  description:
    "Early detection of unusual disease case patterns in DHIS2 aggregate reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={publicSans.variable}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
