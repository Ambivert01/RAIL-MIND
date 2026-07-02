"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useAuthStore } from "@/stores/auth.store";
import { useWebSocket } from "@/hooks/use-websocket";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { PageMotion } from "@/components/common/motion";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  useWebSocket();  // Initialize WebSocket connection

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Topbar />
      <main
        className="overflow-auto"
        style={{
          marginLeft: "var(--sidebar-width)",
          paddingTop: "var(--topbar-height)",
          minHeight: "100vh",
        }}
      >
        <div className="p-6">
          <ErrorBoundary pageName="Page">
            <PageMotion>{children}</PageMotion>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
