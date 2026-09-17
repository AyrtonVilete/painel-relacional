import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { clsx } from "clsx";
import "./globals.css";
import { THEME_COOKIE_KEY, THEME_INIT_SCRIPT } from "@/lib/theme/script";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Painel Relacional",
  description: "Gestão de chamados, sugestões e problemas em formato kanban",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server so the correct theme class is already in the very
  // first HTML sent — no reliance on a client script running in time,
  // which is what made the previous localStorage-only approach flash (or
  // outright fail to persist) on a fresh navigation/reload. THEME_INIT_SCRIPT
  // below only covers a visitor who has never set this cookie yet.
  const cookieStore = await cookies();
  const isDark = cookieStore.get(THEME_COOKIE_KEY)?.value === "dark";

  return (
    <html lang="pt-BR" className={clsx(isDark && "dark")} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100`}
      >
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
