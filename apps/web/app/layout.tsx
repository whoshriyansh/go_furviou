import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Go by Furviou — Gmail outreach sequences",
    template: "%s · Go by Furviou",
  },
  description: SITE.description,
  keywords: [
    "Gmail outreach",
    "email sequences",
    "Go by Furviou",
    "Furviou",
    "lead follow up",
    "IT product studio Delhi",
  ],
  authors: [{ name: SITE.founder.name, url: SITE.studioUrl }],
  alternates: { canonical: SITE.url },
  openGraph: {
    title: "Go by Furviou — Gmail outreach sequences",
    description: SITE.description,
    url: SITE.url,
    siteName: "Go by Furviou",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@whoshriyansh",
    title: "Go by Furviou",
    description: SITE.tagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Go by Furviou",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE.url,
    description: SITE.description,
    creator: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.studioUrl,
      founder: SITE.founder.name,
    },
    isPartOf: { "@type": "WebSite", url: SITE.studioUrl, name: "Furviou" },
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans",
        geistSans.variable,
        geistMono.variable,
        instrumentSerif.variable,
      )}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body>
        <Providers>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
