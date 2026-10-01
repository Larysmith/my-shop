import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { DemoProvider } from "@/components/demo/DemoProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { DEMO_MODE } from "@/lib/demo/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lary Shop",
  description: "Modern essentials, made to last.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const body = (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <CartProvider>
          {DEMO_MODE ? (
            <DemoProvider>
              <AuthProvider>{body}</AuthProvider>
            </DemoProvider>
          ) : (
            <AuthProvider>{body}</AuthProvider>
          )}
        </CartProvider>
      </body>
    </html>
  );
}
