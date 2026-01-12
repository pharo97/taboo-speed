// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");

const {
  createRoom,
  getRoom,
  sanitizeRoom,
  generateBoard,
  rooms,
} = require("./rooms");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// --------------------
// helpers / guards
// --------------------
function ensureRuntime(room) {
  room.runtime ||= {
    roundIntervalId: null,
    roundTimeoutId: null,
    roundRunning: false,
  };
}

function ensureRound(room) {
  room.round ||= {
    number: 0,
    activeTeam: null,
    clueGiverId: null, // current socket.id for authorization/routing
    clueGiverToken: null, // stable token for reconnect reassignment
    startedAt: null,
    endsAt: null,
    board: [],
    guessed: {},
    clue: null,
  };

  room.round.guessed ||= {};
  if (!Array.isArray(room.round.board)) room.round.board = [];
}

function ensureScores(room) {
  room.scores ||= { blue: 0, red: 0 };
}

function ensureTurn(room) {
  room.turn ||= { nextTeam: "blue" };
  if (room.turn.nextTeam !== "blue" && room.turn.nextTeam !== "red") {
    room.turn.nextTeam = "blue";
  }
}

// Identity maps (per room)
function ensureIdentity(room) {
  room.playersByToken ||= {};
  room.tokenBySocketId ||= {};
  room.hostPlayerToken ||= null;
}

function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

function getTokenBySocket(room, socketId) {
  ensureIdentity(room);
  return room.tokenBySocketId[socketId] || null;
}

function getPlayerBySocket(room, socketId) {
  ensureIdentity(room);
  const token = getTokenBySocket(room, socketId);
  if (!token) return null;
  return room.playersByToken[token] || null;
}

function bindSocket(room, socketId, token) {
  ensureIdentity(room);
  room.tokenBySocketId[socketId] = token;

  const p = room.playersByToken[token];
  if (p) {
    p.socketId = socketId;
    p.connected = true;
    p.lastSeenAt = Date.now();
  }

  // If this token is cluegiver in a running round, update clueGiverId to new socket id
  ensureRound(room);
  if (room.status === "playing" && room.runtime?.roundRunning) {
    if (room.round.clueGiverToken && room.round.clueGiverToken === token) {
      room.round.clueGiverId = socketId;
    }
  }
}

function unbindSocket(room, socketId) {
  ensureIdentity(room);
  const token = room.tokenBySocketId[socketId];
  if (!token) return;

  delete room.tokenBySocketId[socketId];

  const p = room.playersByToken[token];
  if (p) {
    p.connected = false;
    p.socketId = null;
    p.lastSeenAt = Date.now();
  }
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

function isRoundRunning(room) {
  return room?.status === "playing" && room?.runtime?.roundRunning === true;
}

function allTilesGuessed(room) {
  const total = room?.round?.board?.length || 0;
  const guessedCount = Object.keys(room?.round?.guessed || {}).length;
  return total > 0 && guessedCount >= total;
}

// --------------------
// Round state privacy
// --------------------
function maskBoard(board = []) {
  // non-cluegivers should NOT see points/difficulty; they only need id + word
  return board.map((t) => ({ id: t.id, word: t.word }));
}

function buildRoundPayload(room, { masked = true } = {}) {
  ensureRound(room);
  return {
    roomCode: room.code,
    round: {
      ...room.round,
      board: masked ? maskBoard(room.round.board) : room.round.board,
      guessed: room.round.guessed || {},
    },
  };
}

// --------------------
// Emitters (single contract)
// --------------------
function emitRoomSync(room, socketId = null) {
  const payload = sanitizeRoom(room);
  if (socketId) io.to(socketId).emit("room:sync", payload);
  else io.to(room.code).emit("room:sync", payload);
}

function emitRoundSync(room, socketId = null) {
  ensureRound(room);
  const clueGiverSocketId = room.round?.clueGiverId || null;

  // targeted sync (rejoin)
  if (socketId) {
    const isClueGiver = !!clueGiverSocketId && socketId === clueGiverSocketId;
    const payload = buildRoundPayload(room, { masked: !isClueGiver });
    io.to(socketId).emit("round:sync", payload);
    return;
  }

  // broadcast: masked to everyone except cluegiver, full to cluegiver
  if (clueGiverSocketId) {
    const maskedPayload = buildRoundPayload(room, { masked: true });
    const fullPayload = buildRoundPayload(room, { masked: false });

    io.to(room.code)
      .except(clueGiverSocketId)
      .emit("round:sync", maskedPayload);
    io.to(clueGiverSocketId).emit("round:sync", fullPayload);
  } else {
    io.to(room.code).emit(
      "round:sync",
      buildRoundPayload(room, { masked: true })
    );
  }
}

function emitClueSync(room, socketId = null) {
  ensureRound(room);
  if (!room.round?.clue) return;

  const payload = {
    roomCode: room.code,
    clue: room.round.clue,
    clueGiverId: room.round.clueGiverId,
    activeTeam: room.round.activeTeam,
  };

  if (socketId) io.to(socketId).emit("clue:sync", payload);
  else io.to(room.code).emit("clue:sync", payload);
}

function pickNewClueGiver(room) {
  ensureIdentity(room);
  ensureRound(room);

  const activeTeam = room.round.activeTeam;
  const playersArr = Object.values(room.playersByToken || {});

  // prefer connected player on active team
  let p =
    playersArr.find(
      (x) => x.team === activeTeam && x.connected && x.socketId
    ) || null;

  // fallback: host if connected
  if (!p && room.hostPlayerToken) {
    const host = room.playersByToken[room.hostPlayerToken];
    if (host?.connected && host?.socketId) p = host;
  }

  // absolute fallback: anyone connected
  if (!p) p = playersArr.find((x) => x.connected && x.socketId) || null;

  if (!p) {
    room.round.clueGiverId = null;
    room.round.clueGiverToken = null;
    return null;
  }

  room.round.clueGiverToken = p.token;
  room.round.clueGiverId = p.socketId;
  return p;
}

function endRound(room, reason = "time") {
  ensureRound(room);
  ensureScores(room);
  clearRoundTimers(room);

  room.status = "lobby";

  emitRoomSync(room);
  io.to(room.code).emit("round:ended", {
    roomCode: room.code,
    roundNumber: room.round?.number ?? 0,
    reason, // "time" | "board" | "manual"
  });
}

function endGame(room, winningTeam) {
  ensureScores(room);
  clearRoundTimers(room);

  room.status = "lobby";

  emitRoomSync(room);
  io.to(room.code).emit("game:ended", {
    roomCode: room.code,
    winningTeam,
    scores: room.scores,
  });
}

// --------------------
// Socket handlers
// --------------------
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ROOM CREATE
  socket.on("room:create", ({ name, password, settings }, cb) => {
    try {
      const room = createRoom({ password, settings });
      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);

      const token = newToken();

      room.playersByToken[token] = {
        token,
        socketId: socket.id,
        name: (name || "Player").trim().slice(0, 40),
        team: null,
        isHost: true,
        connected: true,
        lastSeenAt: Date.now(),
      };

      room.hostPlayerToken = token;

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code; // ✅ track room for disconnect fast-path

      emitRoomSync(room);
      cb?.({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:create failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to create room" });
    }
  });

  // ROOM JOIN
  socket.on("room:join", ({ roomCode, name, password }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);

      if (room.password !== password) {
        return cb?.({ ok: false, error: "Wrong password" });
      }

      const token = newToken();

      room.playersByToken[token] = {
        token,
        socketId: socket.id,
        name: (name || "Player").trim().slice(0, 40),
        team: null,
        isHost: false,
        connected: true,
        lastSeenAt: Date.now(),
      };

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code; // ✅ track room for disconnect fast-path

      emitRoomSync(room);
      cb?.({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:join failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to join room" });
    }
  });

  // ROOM REJOIN (token-based) - ACK then targeted sync
  socket.on("room:rejoin", ({ roomCode, playerToken, name }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);

      const p = room.playersByToken[playerToken];
      if (!p) return cb?.({ ok: false, error: "Invalid player token" });

      const cleanName = (name || "").trim();
      if (cleanName) p.name = cleanName.slice(0, 40);

      bindSocket(room, socket.id, playerToken);
      socket.join(room.code);
      socket.data.roomCode = room.code; // ✅ track room for disconnect fast-path

      // ACK first
      cb?.({ ok: true, roomCode: room.code, playerToken });

      // targeted sync only
      emitRoomSync(room, socket.id);

      if (isRoundRunning(room)) {
        if (room.round.clueGiverToken === playerToken) {
          room.round.clueGiverId = socket.id;
        }
        emitRoundSync(room, socket.id);
        if (room.round?.clue) emitClueSync(room, socket.id);
      }
    } catch (err) {
      console.error("room:rejoin failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to rejoin room" });
    }
  });

  // TEAM SET
  socket.on("room:team:set", ({ roomCode, team }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (team !== "blue" && team !== "red") {
        return cb?.({ ok: false, error: "Invalid team" });
      }

      player.team = team;
      player.lastSeenAt = Date.now();

      emitRoomSync(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:team:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set team" });
    }
  });

  // HOST KICK (by playerToken)
  socket.on("room:player:kick", ({ roomCode, playerToken }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);

      const actor = getPlayerBySocket(room, socket.id);
      if (!actor) return cb?.({ ok: false, error: "Player not in room" });

      if (room.hostPlayerToken !== actor.token) {
        return cb?.({ ok: false, error: "Only host can kick" });
      }

      const target = room.playersByToken[playerToken];
      if (!target) return cb?.({ ok: false, error: "Player not found" });

      if (target.token === room.hostPlayerToken) {
        return cb?.({ ok: false, error: "Host cannot kick self" });
      }

      if (target.socketId) {
        io.to(target.socketId).emit("room:kicked", {
          roomCode: room.code,
          reason: "kicked",
        });

        const s = io.sockets.sockets.get(target.socketId);
        try {
          s?.leave(room.code);
          s?.disconnect(true);
        } catch {}
      }

      // remove any reverse mappings still pointing to this token
      for (const [sid, tok] of Object.entries(room.tokenBySocketId || {})) {
        if (tok === playerToken) delete room.tokenBySocketId[sid];
      }

      delete room.playersByToken[playerToken];

      emitRoomSync(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:player:kick failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to kick player" });
    }
  });

  // ROUND START (host only)
  socket.on("round:start", ({ roomCode }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (room.hostPlayerToken !== player.token) {
        return cb?.({ ok: false, error: "Only host can start" });
      }

      const now = Date.now();
      const currentEndsAt = room.round?.endsAt ?? 0;

      if (
        room.runtime.roundRunning &&
        currentEndsAt > 0 &&
        now < currentEndsAt
      ) {
        return cb?.({ ok: false, error: "Round already running" });
      }

      if (
        room.status === "playing" &&
        currentEndsAt > 0 &&
        now >= currentEndsAt
      ) {
        endRound(room, "time");
      }

      clearRoundTimers(room);
      room.runtime.roundRunning = true;

      const activeTeam = room.turn?.nextTeam || "blue";

      // pick cluegiver (token + socketId)
      const playersArr = Object.values(room.playersByToken || {});
      const hostPlayer = room.playersByToken[room.hostPlayerToken] || null;

      let clueGiver =
        playersArr.find(
          (p) => p.team === activeTeam && p.connected && p.socketId
        ) ||
        (hostPlayer?.connected && hostPlayer?.socketId ? hostPlayer : null) ||
        player;

      const startedAt = Date.now();
      const durationMs = (room.settings?.roundSeconds ?? 30) * 1000;
      const endsAt = startedAt + durationMs;

      room.round.number = (room.round.number || 0) + 1;
      room.round.activeTeam = activeTeam;

      room.round.clueGiverToken = clueGiver.token;
      room.round.clueGiverId = clueGiver.socketId || null;

      room.round.startedAt = startedAt;
      room.round.endsAt = endsAt;
      room.round.board = generateBoard(24);
      room.round.guessed = {};
      room.round.clue = null;

      room.status = "playing";
      room.turn.nextTeam = activeTeam === "blue" ? "red" : "blue";

      emitRoomSync(room);
      emitRoundSync(room);

      // timer tick (tiny)
      const intervalId = setInterval(() => {
        const remainingMs = Math.max(0, room.round.endsAt - Date.now());
        io.to(room.code).emit("round:tick", {
          roomCode: room.code,
          remainingMs,
        });

        if (remainingMs <= 0) {
          clearInterval(intervalId);
          endRound(room, "time");
        }
      }, 1000);

      room.runtime.roundIntervalId = intervalId;

      const timeoutId = setTimeout(
        () => endRound(room, "time"),
        durationMs + 50
      );
      room.runtime.roundTimeoutId = timeoutId;

      cb?.({ ok: true, round: { ...room.round } });
    } catch (err) {
      console.error("round:start failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to start round" });
    }
  });

  // CLUE SET
  socket.on("clue:set", ({ roomCode, text }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });
      if (!isRoundRunning(room))
        return cb?.({ ok: false, error: "No active round" });

      ensureRound(room);
      ensureIdentity(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (room.round?.clueGiverId !== socket.id) {
        return cb?.({ ok: false, error: "Only cluegiver can set clue" });
      }

      const cleanText = (text || "").trim().slice(0, 80);
      if (!cleanText) return cb?.({ ok: false, error: "Clue text required" });

      room.round.clue = { text: cleanText, setAt: Date.now() };

      emitClueSync(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("clue:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set clue" });
    }
  });

  // GUESS SUBMIT (active team only)
  socket.on("guess:submit", ({ roomCode, tileId }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });
      if (!isRoundRunning(room))
        return cb?.({ ok: false, error: "No active round" });

      ensureRound(room);
      ensureScores(room);
      ensureIdentity(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      const activeTeam = room.round?.activeTeam;
      if (player.team !== activeTeam) {
        return cb?.({ ok: false, error: "Not your team's turn" });
      }

      const board = room.round?.board || [];
      const tile = board.find((t) => t.id === tileId);
      if (!tile) return cb?.({ ok: false, error: "Tile not found" });

      if (room.round.guessed[tileId]) {
        return cb?.({ ok: false, error: "Already guessed" });
      }

      // apply
      room.round.guessed[tileId] = {
        by: player.token,
        team: activeTeam,
        at: Date.now(),
        points: tile.points,
      };

      room.scores[activeTeam] += tile.points;

      const delta = {
        roomCode: room.code,
        tileId,
        team: activeTeam,
        points: tile.points,
        scores: room.scores,
        by: player.token,
      };

      io.to(room.code).emit("guess:applied", delta);

      // ACK to submitter
      cb?.({ ok: true, ...delta });

      // win / end checks
      const target = room.settings?.targetScore ?? 300;
      if (room.scores[activeTeam] >= target) {
        endGame(room, activeTeam);
        return;
      }

      if (allTilesGuessed(room)) {
        endRound(room, "board");
        return;
      }
    } catch (err) {
      console.error("guess:submit failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to submit guess" });
    }
  });

  // ✅ disconnect: fast-path using socket.data.roomCode, then fallback scan
  socket.on("disconnect", () => {
    try {
      const preferredRoomCode = socket.data?.roomCode;
      const roomCodesToCheck = [];

      if (preferredRoomCode) roomCodesToCheck.push(preferredRoomCode);

      for (const c of Object.keys(rooms || {})) {
        if (c !== preferredRoomCode) roomCodesToCheck.push(c);
      }

      for (const code of roomCodesToCheck) {
        const room = rooms?.[code];
        if (!room) continue;

        ensureIdentity(room);
        ensureRuntime(room);
        ensureRound(room);

        if (!room.tokenBySocketId?.[socket.id]) continue;

        unbindSocket(room, socket.id);

        // if disconnecting socket was cluegiver, reassign if round is running and clue not set yet
        if (isRoundRunning(room) && room.round?.clueGiverId === socket.id) {
          room.round.clueGiverId = null;

          if (!room.round.clue) {
            pickNewClueGiver(room);
            emitRoundSync(room);
          }
        }

        emitRoomSync(room);

        // handled; stop scanning
        break;
      }
    } catch {}

    console.log("Disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
