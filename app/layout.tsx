import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalProvider } from "./context/GlobalContext";
import Header from "./components/header";
import IntroSplash from "./components/IntroSplash";
import SiteJsonLd from "./components/SiteJsonLd";
import UserTourHost from "./components/UserTourHost";
import RequiredSignupGate from "./components/RequiredSignupGate";
import { THEME_BOOT_SCRIPT, THEME_COOKIE, themeIdFromUnknown } from "@/lib/theme-persist";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site-seo";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "entertainment",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

/** Responsive + notch; se permite zoom (accesibilidad). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf5" },
    { media: "(prefers-color-scheme: dark)", color: "#272822" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = themeIdFromUnknown((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="es" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body 
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ margin: 0 }}
      >
        <GlobalProvider>
          <SiteJsonLd />
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", minWidth: 0, backgroundColor: "var(--bg-main)" }}>
            
            <Header />
            <IntroSplash />
            <UserTourHost />
            <RequiredSignupGate />
            
            {/* El contenido de las páginas carga aquí */}
            <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
              {children}
            </main>
            
          </div>
        </GlobalProvider>
        <Analytics />
      </body>
    </html>
  );
}