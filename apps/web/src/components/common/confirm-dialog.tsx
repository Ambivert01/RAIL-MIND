"use client";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", variant = "danger", onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  const btnCls = variant === "danger"
    ? "bg-red-500 hover:bg-red-600 text-white"
    : "bg-orange-500 hover:bg-orange-600 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-glass border border-border rounded-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg flex-shrink-0", variant === "danger" ? "bg-red-500/10" : "bg-orange-500/10")}>
            <AlertTriangle className={cn("w-5 h-5", variant === "danger" ? "text-red-400" : "text-orange-400")} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button onClick={handle} disabled={loading}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", btnCls)}>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
