import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "./providers";
import ConditionalNavbar from "./components/ConditionalNavbar";
import ConditionalFooter from "./components/ConditionalFooter";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { routing } from "@/i18n/routing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golden Market",
  description: "Golden Market is a platform for buying and selling products.",
  openGraph: {
    title: "Golden Market",
    description: "Golden Market is a platform for buying and selling products.",
    type: "website",
    url: "https://goldenmarket.com",
    siteName: "Golden Market",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
      },
    ],
  },
  manifest: "/site.webmanifest",
};

export function generateStaticParams(): Promise<{ locale: string }[]> {
  return Promise.resolve(routing.locales.map((locale: string) => ({ locale })));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Load messages for the locale
  let messages;
  try {
    messages = await getMessages({ locale });
  } catch (error) {
    console.error("Error loading messages:", error);
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {/* Conditionally render Navbar - hide on dashboard routes */}
            <ConditionalNavbar />
            <main className="flex-1 flex flex-col">{children}</main>
            {/* Conditionally render Footer - hide on dashboard routes */}
            <ConditionalFooter />
            <Toaster position="top-right" />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
