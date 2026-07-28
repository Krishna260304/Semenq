import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

export function useRealtimeRefresh(queryClient: QueryClient) {
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime/ws`);

    socket.addEventListener("error", () => socket.close());

    socket.addEventListener("message", () => {
      queryClient.invalidateQueries();
    });

    return () => socket.close();
  }, [queryClient]);
}
