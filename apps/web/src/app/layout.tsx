import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "RailMind — Cognitive Railway Operating System",
  description: "Preserving Railway Expertise. Powering Intelligent Operations.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(224 71% 6%)",
              color: "hsl(213 31% 91%)",
              border: "1px solid hsl(215 25% 14%)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
