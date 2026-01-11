const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { createRoom, getRoom, addPlayer, sanitizeRoom } = require("./rooms");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("room:create", ({ name, password, settings }, cb) => {
    try {
      const room = createRoom({ password, settings });

      const player = {
        id: socket.id,
        name: (name || "Player").trim(),
        team: null,
        isHost: false,
        connected: true,
      };

      addPlayer(room, player);
      socket.join(room.code);

      io.to(room.code).emit("room:state", sanitizeRoom(room));
      cb?.({ ok: true, roomCode: room.code, playerId: player.id });
    } catch (err) {
      console.error("room:create failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to create room" });
    }
  });

  socket.on("room:join", ({ roomCode, name, password }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      if (room.password !== password) {
        return cb?.({ ok: false, error: "Wrong password" });
      }

      const player = {
        id: socket.id,
        name: (name || "Player").trim(),
        team: null,
        isHost: false,
        connected: true,
      };

      addPlayer(room, player);
      socket.join(room.code);

      io.to(room.code).emit("room:state", sanitizeRoom(room));
      cb?.({ ok: true, roomCode: room.code, playerId: player.id });
    } catch (err) {
      console.error("room:join failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to join room" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

server.listen(4000, () => {
  console.log("Socket server running on port 4000");
});
