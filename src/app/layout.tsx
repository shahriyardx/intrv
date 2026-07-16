import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

// Three roles, three faces: a serif for editorial display, a sans for reading
// (question prose runs long — mono would fight the reader), mono for data.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, Next resolves og:image against http://localhost:3000 and every
  // shared link ships a preview card pointing at the sharer's own machine.
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: "Intrv — Practice interviews that teach you something",
    template: "%s · Intrv",
  },
  description:
    "Generate a quiz or interview on any topic, answer it, and get graded feedback that tells you what to study next. No account required.",
};

export const viewport: Viewport = {
  // Dark-only, so one colour and a fixed scheme — telling the browser otherwise
  // makes it paint form controls and scrollbars for a theme we never render.
  themeColor: "#0e0d0b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The app is dark-only: there is no theme switch, so the class is fixed
      // here rather than resolved at runtime. The light tokens in globals.css
      // stay as the base that this overrides.
      className={cn(
        "dark",
        "h-full",
        "antialiased",
        geistSans.variable,
        jetbrainsMono.variable,
        newsreader.variable,
      )}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
