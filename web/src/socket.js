import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

if (!SERVER_URL) {
  // Fail loudly so you don't ship a "localhost" build ever again
  throw new Error(
    "Missing VITE_SERVER_URL. Set it in Vercel Environment Variables.",
  );
}

export function createSocket() {
  return io(SERVER_URL, {
    transports: ["websocket", "polling"], // websocket first, then fallback
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 300,
    timeout: 8000,
  });
}
