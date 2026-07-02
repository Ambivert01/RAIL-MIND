"use client";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { notificationsApi } from "@/lib/api-client";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import toast from "react-hot-toast";

const TYPE_COLORS: Record<string, string> = {
  CRITICAL: "border-l-red-500 bg-red-500/5",
  WARNING:  "border-l-orange-500 bg-orange-500/5",
  INFO:     "border-l-blue-500 bg-blue-500/5",
  SUCCESS:  "border-l-green-500 bg-green-500/5",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationsApi.getAll()
      .then((r) => setNotifications(r.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Bell className="w-10 h-10 opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div
                key={n.id}
                className={cn(
                  "p-4 rounded-lg border-l-4 border border-border/30 transition-colors",
                  TYPE_COLORS[n.type] ?? TYPE_COLORS.INFO,
                  !n.read && "opacity-100",
                  n.read && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
