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
 * We re-ensure it constantly because humans keep editing room shape mid-run.
 */
function ensureRuntime(room) {
  if (!room.runtime) {
    room.runtime = { roundIntervalId: null, roundTimeoutId: null };
  }
}

function clearRoundTimers(room) {
  if (!room) return;
  ensureRuntime(room);

  if (room.runtime.roundIntervalId) {
    clearInterval(room.runtime.roundIntervalId);
    room.runtime.roundIntervalId = null;
  }
  if (room.runtime.roundTimeoutId) {
    clearTimeout(room.runtime.roundTimeoutId);
    room.runtime.roundTimeoutId = null;
  }
}

function endRound(room) {
  if (!room) return;

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
        isHost: true, // ✅ host
        connected: true,
      };

      addPlayer(room, player); // addPlayer also sets hostPlayerId (fine)
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

      // ✅ Host check based on room.hostPlayerId (more reliable than player.isHost flags)
      if (room.hostPlayerId !== socket.id) {
        return cb?.({ ok: false, error: "Only host can start" });
      }

      ensureRuntime(room);

      // Stop any existing timers (prevents multiple intervals + spam)
      clearRoundTimers(room);

      const activeTeam = room.turn?.nextTeam || "blue";

      // Pick clue giver: someone on active team, else host
      const playersArr = Object.values(room.players || {});
      const clueGiver =
        playersArr.find((p) => p.team === activeTeam) ||
        playersArr.find((p) => p.id === room.hostPlayerId) ||
        player;

      const startedAt = Date.now();
      const durationMs = (room.settings?.roundSeconds ?? 30) * 1000;
      const endsAt = startedAt + durationMs;

      // Ensure round exists
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
      room.round.endsAt = endsAt;
      room.round.board = generateBoard(24);
      room.round.guessed = {};

      room.status = "playing";
      room.turn ||= { nextTeam: "blue" };
      room.turn.nextTeam = activeTeam === "blue" ? "red" : "blue";

      // Broadcast new state
      io.to(room.code).emit("room:state", sanitizeRoom(room));
      io.to(room.code).emit("round:state", {
        roomCode: room.code,
        round: room.round,
      });

      // ✅ Create interval FIRST, store it AFTER (and make it self-destruct)
      const intervalId = setInterval(() => {
        const remainingMs = Math.max(0, room.round.endsAt - Date.now());

        io.to(room.code).emit("round:tick", {
          roomCode: room.code,
          remainingMs,
        });

        if (remainingMs <= 0) {
          clearInterval(intervalId); // self-destruct even if runtime tracking breaks
          endRound(room);
        }
      }, 1000);

      ensureRuntime(room);
      room.runtime.roundIntervalId = intervalId;

      // Backup timeout
      const timeoutId = setTimeout(() => {
        endRound(room);
      }, durationMs + 50);

      ensureRuntime(room);
      room.runtime.roundTimeoutId = timeoutId;

      cb?.({ ok: true, round: room.round });
    } catch (err) {
      console.error("round:start failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to start round" });
    }
  });

  // --------------------
  // DISCONNECT
  // --------------------
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    // Optional: mark player disconnected in any room they were in
    // (not required for your current test client)
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
