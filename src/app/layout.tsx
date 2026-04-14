import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Verisum",
  description: "AI governance you can measure, monitor, and prove",
};

// Force every route to server-render on demand instead of being
// prerendered as static HTML + RSC Flight files. Hostinger's static
// file serving was returning the prefetch .rsc payload as the HTML
// response for navigations to /dashboard and other client-auth pages,
// causing the browser to render raw Flight text. Because this is an
// auth-gated internal app, static prerender adds no real value.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} antialiased`}>
        <AuthProvider>
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
