import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalProvider } from "./context/GlobalContext";
import Header from "./components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Kpop Binder | Tu colección al día",
  description: "Organiza, compra y vende tus photocards favoritas.",
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body 
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ 
          margin: 0, 
          transition: "background-color 0.3s ease, color 0.3s ease" // 👈 Cambio de tema fluido
        }}
      >
        <GlobalProvider>
          {/* Contenedor principal para asegurar que el Header y el contenido no bailen */}
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", minWidth: 0, backgroundColor: "var(--bg-main)" }}>
            
            {/* El Header es fijo en la parte superior */}
            <Header />
            
            {/* El contenido de las páginas carga aquí */}
            <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
              {children}
            </main>
            
          </div>
        </GlobalProvider>
      </body>
    </html>
  );
}