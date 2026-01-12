// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const {
  createRoom,
  getRoom,
  addPlayer,
  sanitizeRoom,
  generateBoard,
} = require("./rooms");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

/**
 * Runtime timer storage lives on the REAL room object (never sanitized).
 */
function ensureRuntime(room) {
  room.runtime ||= {
    roundIntervalId: null,
    roundTimeoutId: null,
    roundRunning: false,
  };
}

function clearRoundTimers(room) {
  ensureRuntime(room);

  if (room.runtime.roundIntervalId) {
    clearInterval(room.runtime.roundIntervalId);
    room.runtime.roundIntervalId = null;
  }

  if (room.runtime.roundTimeoutId) {
    clearTimeout(room.runtime.roundTimeoutId);
    room.runtime.roundTimeoutId = null;
  }

  room.runtime.roundRunning = false;
}

function endRound(room) {
  clearRoundTimers(room);

  room.status = "lobby";

  io.to(room.code).emit("room:state", sanitizeRoom(room));
  io.to(room.code).emit("round:ended", {
    roomCode: room.code,
    roundNumber: room.round?.number ?? 0,
  });
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // --------------------
  // ROOM CREATE
  // --------------------
  socket.on("room:create", ({ name, password, settings }, cb) => {
    try {
      const room = createRoom({ password, settings });
      ensureRuntime(room);

      const player = {
        id: socket.id,
        name: (name || "Player").trim(),
        team: null,
        isHost: true, // host on create
        connected: true,
      };

      addPlayer(room, player); // addPlayer also sets hostPlayerId for first player
      socket.join(room.code);

      io.to(room.code).emit("room:state", sanitizeRoom(room));
      cb?.({ ok: true, roomCode: room.code, playerId: player.id });
    } catch (err) {
      console.error("room:create failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to create room" });
    }
  });

  // --------------------
  // ROOM JOIN
  // --------------------
  socket.on("room:join", ({ roomCode, name, password }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);

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

  // --------------------
  // TEAM SET
  // --------------------
  socket.on("room:team:set", ({ roomCode, team }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      const player = room.players?.[socket.id];
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (team !== "blue" && team !== "red") {
        return cb?.({ ok: false, error: "Invalid team" });
      }

      player.team = team;

      io.to(room.code).emit("room:state", sanitizeRoom(room));
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:team:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set team" });
    }
  });

  // --------------------
  // ROUND START
  // --------------------
  socket.on("round:start", ({ roomCode }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      const player = room.players?.[socket.id];
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      // host check: use hostPlayerId (most reliable)
      if (room.hostPlayerId !== socket.id) {
        return cb?.({ ok: false, error: "Only host can start" });
      }

      ensureRuntime(room);

      // ✅ HARD BLOCK: if a round is already running AND not expired, reject.
      const now = Date.now();
      const endsAt = room.round?.endsAt ?? 0;

      if (room.runtime.roundRunning && now < endsAt) {
        return cb?.({ ok: false, error: "Round already running" });
      }

      // If state says "playing" but time is over, clean it up first.
      if (room.status === "playing" && now >= endsAt && endsAt > 0) {
        endRound(room);
      }

      // start fresh
      room.runtime.roundRunning = true;

      const activeTeam = room.turn?.nextTeam || "blue";

      const playersArr = Object.values(room.players || {});
      const clueGiver =
        playersArr.find((p) => p.team === activeTeam) ||
        playersArr.find((p) => p.id === room.hostPlayerId) ||
        player;

      const startedAt = Date.now();
      const durationMs = (room.settings?.roundSeconds ?? 30) * 1000;
      const newEndsAt = startedAt + durationMs;

      room.round ||= {
        number: 0,
        activeTeam: null,
        clueGiverId: null,
        startedAt: null,
        endsAt: null,
        board: [],
        guessed: {},
      };

      room.round.number = (room.round.number || 0) + 1;
      room.round.activeTeam = activeTeam;
      room.round.clueGiverId = clueGiver.id;
      room.round.startedAt = startedAt;
      room.round.endsAt = newEndsAt;
      room.round.board = generateBoard(24);
      room.round.guessed = {};

      room.status = "playing";
      room.turn ||= { nextTeam: "blue" };
      room.turn.nextTeam = activeTeam === "blue" ? "red" : "blue";

      io.to(room.code).emit("room:state", sanitizeRoom(room));
      io.to(room.code).emit("round:state", {
        roomCode: room.code,
        round: room.round,
      });

      // Tick interval
      const intervalId = setInterval(() => {
        const remainingMs = Math.max(0, room.round.endsAt - Date.now());

        io.to(room.code).emit("round:tick", {
          roomCode: room.code,
          remainingMs,
        });

        if (remainingMs <= 0) {
          clearInterval(intervalId);
          endRound(room);
        }
      }, 1000);

      room.runtime.roundIntervalId = intervalId;

      // Backup timeout
      const timeoutId = setTimeout(() => {
        endRound(room);
      }, durationMs + 50);

      room.runtime.roundTimeoutId = timeoutId;

      cb?.({ ok: true, round: room.round });
    } catch (err) {
      console.error("round:start failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to start round" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
