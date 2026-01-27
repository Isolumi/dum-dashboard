import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DUM",
  description: "dumdumdumdumdumdumdumdum",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className={`${inter.variable} antialiased font-sans`}>
        <SidebarProvider>
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </header>
            <main className="flex-1 overflow-auto p-4">{children}</main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
