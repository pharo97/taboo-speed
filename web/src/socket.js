// web/src/socket.js
import { io } from "socket.io-client";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export function createSocket() {
  const s = io(SERVER_URL, {
    transports: ["polling", "websocket"], // allow fallback, then upgrade
    reconnection: true,
    timeout: 8000,
    autoConnect: true,
  });

  // Debug logging (temporary but useful)
  s.on("connect", () => console.log("[socket] connected", s.id));
  s.on("disconnect", (reason) => console.log("[socket] disconnected", reason));
  s.on("connect_error", (err) =>
    console.log("[socket] connect_error", err?.message || err)
  );

  console.log("[socket] SERVER_URL =", SERVER_URL);

  return s;
}
