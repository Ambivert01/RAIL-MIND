"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAgentStore } from "@/stores/agent.store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

// CQ-023 FIX: socket stored in module-level ref but managed per-instance
// to avoid StrictMode double-init creating duplicate connections
let socketInstance: Socket | null = null;
let refCount = 0;

export function useWebSocket() {
  const { addThought, setWorkflowStatus, setLastResponse } = useAgentStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    refCount++;
    if (!socketInstance || !socketInstance.connected) {
      socketInstance = io(`${WS_URL}/ws`, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      socketInstance.on("connect", () => {
        if (process.env.NODE_ENV === "development") console.log("🔌 WS connected");
      });
      socketInstance.on("disconnect", () => {
        if (process.env.NODE_ENV === "development") console.log("🔌 WS disconnected");
      });
    }

    socketRef.current = socketInstance;

    const onThought = (data: any) => addThought(data);
    const onWorkflowStarted = (data: any) => setWorkflowStatus("running", data.question);
    const onWorkflowCompleted = (data: any) => {
      setWorkflowStatus("completed");
      if (data?.response) setLastResponse(data.response);
    };

    socketInstance.on("agent:thought", onThought);
    socketInstance.on("workflow:started", onWorkflowStarted);
    socketInstance.on("workflow:completed", onWorkflowCompleted);

    return () => {
      socketInstance?.off("agent:thought", onThought);
      socketInstance?.off("workflow:started", onWorkflowStarted);
      socketInstance?.off("workflow:completed", onWorkflowCompleted);
      refCount--;
      // Only disconnect when last consumer unmounts
      if (refCount === 0) {
        socketInstance?.disconnect();
        socketInstance = null;
      }
    };
  }, []);

  return socketRef.current;
}

export const getSocket = () => socketInstance;
