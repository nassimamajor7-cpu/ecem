import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

// Police très lisible + police arabe pour les mots arabes éventuels
const lisible = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-lisible",
});
const arabe = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabe",
});

export const metadata: Metadata = {
  title: "Points de la classe",
  description: "Site de points de la classe",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${lisible.variable} ${arabe.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
