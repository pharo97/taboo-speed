import { io } from "socket.io-client";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export function createSocket() {
  return io(SERVER_URL, {
    transports: ["polling", "websocket"], // allow fallback
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 300,
    timeout: 8000,
  });
}
