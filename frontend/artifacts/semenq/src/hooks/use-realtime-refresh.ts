import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

export function useRealtimeRefresh(queryClient: QueryClient) {
  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/api/realtime/ws");

    socket.addEventListener("message", () => {
      queryClient.invalidateQueries();
    });

    return () => socket.close();
  }, [queryClient]);
}