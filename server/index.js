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
// Room cleanup
// --------------------
function cleanupInactiveRooms() {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  for (const [code, room] of Object.entries(rooms)) {
    const allDisconnected = Object.values(room.playersByToken || {}).every(
      (p) => !p.connected
    );
    const inactive =
      now - (room.lastActivity || room.createdAt) > THIRTY_MINUTES;

    if (allDisconnected && inactive) {
      console.log(`Cleaning up inactive room: ${code}`);
      clearRoundTimers(room);
      delete rooms[code];
    }
  }
}

setInterval(cleanupInactiveRooms, 5 * 60 * 1000);

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
    clueGiverId: null,
    clueGiverToken: null,
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

function ensureIdentity(room) {
  room.playersByToken ||= {};
  room.tokenBySocketId ||= {};
  room.hostPlayerToken ||= null;
}

function ensureSettings(room) {
  room.settings ||= { roundSeconds: 30, targetScore: 300 };

  // sanity defaults if something weird got stored
  if (typeof room.settings.roundSeconds !== "number")
    room.settings.roundSeconds = 30;
  if (typeof room.settings.targetScore !== "number")
    room.settings.targetScore = 300;
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

  ensureRound(room);
  if (room.status === "playing" && room.runtime?.roundRunning) {
    if (room.round.clueGiverToken && room.round.clueGiverToken === token) {
      room.round.clueGiverId = socketId;
    }
  }

  room.lastActivity = Date.now();
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

  room.lastActivity = Date.now();
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
// Round state privacy - NEW LOGIC
// --------------------
function buildRoundPayload(room, socketId) {
  ensureRound(room);
  const clueGiverSocketId = room.round?.clueGiverId || null;
  const isClueGiver = socketId && socketId === clueGiverSocketId;

  if (isClueGiver) {
    // Cluegiver sees FULL board with all words and points
    return {
      roomCode: room.code,
      round: {
        number: room.round.number,
        activeTeam: room.round.activeTeam,
        clueGiverId: room.round.clueGiverId,
        clueGiverToken: room.round.clueGiverToken,
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        board: room.round.board, // FULL board
        guessed: room.round.guessed,
        clue: room.round.clue,
      },
      role: "cluegiver",
    };
  } else {
    // Everyone else sees NO words, only guess history
    return {
      roomCode: room.code,
      round: {
        number: room.round.number,
        activeTeam: room.round.activeTeam,
        clueGiverId: room.round.clueGiverId,
        clueGiverToken: room.round.clueGiverToken,
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        board: [], // EMPTY
        guessed: room.round.guessed,
        clue: room.round.clue,
      },
      role: "guesser",
    };
  }
}

// --------------------
// Emitters
// --------------------
function emitRoomSync(room, socketId = null) {
  const payload = sanitizeRoom(room);
  if (socketId) io.to(socketId).emit("room:sync", payload);
  else io.to(room.code).emit("room:sync", payload);
}

function emitRoundSync(room, socketId = null) {
  ensureRound(room);
  const clueGiverSocketId = room.round?.clueGiverId || null;

  if (socketId) {
    const payload = buildRoundPayload(room, socketId);
    io.to(socketId).emit("round:sync", payload);
    return;
  }

  if (clueGiverSocketId) {
    const cluegiverPayload = buildRoundPayload(room, clueGiverSocketId);
    const guesserPayload = buildRoundPayload(room, null);

    io.to(clueGiverSocketId).emit("round:sync", cluegiverPayload);
    io.to(room.code)
      .except(clueGiverSocketId)
      .emit("round:sync", guesserPayload);
  } else {
    const payload = buildRoundPayload(room, null);
    io.to(room.code).emit("round:sync", payload);
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

  let p =
    playersArr.find(
      (x) => x.team === activeTeam && x.connected && x.socketId
    ) || null;

  if (!p && room.hostPlayerToken) {
    const host = room.playersByToken[room.hostPlayerToken];
    if (host?.connected && host?.socketId) p = host;
  }

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
  room.lastActivity = Date.now();

  emitRoomSync(room);

  io.to(room.code).emit("round:ended", {
    roomCode: room.code,
    roundNumber: room.round?.number ?? 0,
    reason,
    fullBoard: room.round.board,
    guessed: room.round.guessed,
    scores: room.scores,
  });
}

function endGame(room, winningTeam) {
  ensureScores(room);
  clearRoundTimers(room);

  room.status = "lobby";
  room.lastActivity = Date.now();

  emitRoomSync(room);

  io.to(room.code).emit("game:ended", {
    roomCode: room.code,
    winningTeam,
    scores: room.scores,
    fullBoard: room.round.board,
    guessed: room.round.guessed,
  });
}

// --------------------
// Socket handlers
// --------------------
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("room:create", ({ name, settings }, cb) => {
    try {
      const room = createRoom({ settings }); // no password
      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);

      const token = newToken();

      room.playersByToken[token] = {
        token,
        socketId: socket.id,
        name: (name || "Host").trim().slice(0, 40),
        team: null,
        isHost: true,
        connected: true,
        lastSeenAt: Date.now(),
      };

      room.hostPlayerToken = token;

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      emitRoomSync(room);

      if (cb) cb({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:create failed:", err);
      if (cb) cb({ ok: false, error: err?.message || "Failed to create room" });
    }
  });

  socket.on("room:join", ({ roomCode, name }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) {
        if (cb) return cb({ ok: false, error: "Room not found" });
        return;
      }

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
        isHost: false,
        connected: true,
        lastSeenAt: Date.now(),
      };

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      emitRoomSync(room);

      if (cb) cb({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:join failed:", err);
      if (cb) cb({ ok: false, error: err?.message || "Failed to join room" });
    }
  });

  socket.on("room:rejoin", ({ roomCode, playerToken, name }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);

      const p = room.playersByToken[playerToken];
      if (!p) return cb?.({ ok: false, error: "Invalid player token" });

      const cleanName = (name || "").trim();
      if (cleanName) p.name = cleanName.slice(0, 40);

      bindSocket(room, socket.id, playerToken);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      cb?.({ ok: true, roomCode: room.code, playerToken });

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

  // ✅ NEW: Host-only settings update (lobby only)
  socket.on("room:settings:set", ({ roomCode, settings }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);
      ensureSettings(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (room.hostPlayerToken !== player.token) {
        return cb?.({ ok: false, error: "Only host can change settings" });
      }

      if (room.status !== "lobby") {
        return cb?.({
          ok: false,
          error: "Settings can only be changed in lobby",
        });
      }

      const roundSecondsRaw = settings?.roundSeconds;
      const targetScoreRaw = settings?.targetScore;

      const roundSeconds = Number(roundSecondsRaw);
      const targetScore = Number(targetScoreRaw);

      if (
        !Number.isFinite(roundSeconds) ||
        roundSeconds < 10 ||
        roundSeconds > 300
      ) {
        return cb?.({ ok: false, error: "roundSeconds must be 10–300" });
      }
      if (
        !Number.isFinite(targetScore) ||
        targetScore < 25 ||
        targetScore > 5000
      ) {
        return cb?.({ ok: false, error: "targetScore must be 25–5000" });
      }

      room.settings.roundSeconds = Math.floor(roundSeconds);
      room.settings.targetScore = Math.floor(targetScore);
      room.lastActivity = Date.now();

      emitRoomSync(room);

      cb?.({ ok: true, settings: room.settings });
    } catch (err) {
      console.error("room:settings:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set settings" });
    }
  });

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
      room.lastActivity = Date.now();

      emitRoomSync(room);

      cb?.({ ok: true });
    } catch (err) {
      console.error("room:team:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set team" });
    }
  });

  socket.on("round:start", ({ roomCode }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      // ✅ Option 1: only host starts rounds. Always.
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
      room.lastActivity = Date.now();

      emitRoomSync(room);
      emitRoundSync(room);

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

      cb?.({ ok: true });
    } catch (err) {
      console.error("round:start failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to start round" });
    }
  });

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
      room.lastActivity = Date.now();

      emitClueSync(room);

      cb?.({ ok: true });
    } catch (err) {
      console.error("clue:set failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to set clue" });
    }
  });

  socket.on("guess:text", ({ roomCode, text }, cb) => {
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

      const guess = (text || "").toLowerCase().trim();
      if (!guess) return cb?.({ ok: false, error: "Empty guess" });

      const board = room.round?.board || [];
      const tile = board.find(
        (t) => t.word.toLowerCase() === guess && !room.round.guessed[t.id]
      );

      if (!tile) return cb?.({ ok: false, incorrect: true });

      room.round.guessed[tile.id] = {
        word: tile.word,
        points: tile.points,
        by: player.name,
        byToken: player.token,
        team: activeTeam,
        at: Date.now(),
      };

      room.scores[activeTeam] += tile.points;
      room.lastActivity = Date.now();

      const activeTeamSockets = Object.values(room.playersByToken)
        .filter((p) => p.team === activeTeam && p.socketId)
        .map((p) => p.socketId);

      const payload = {
        roomCode: room.code,
        tileId: tile.id,
        word: tile.word,
        points: tile.points,
        guessedBy: player.name,
        scores: room.scores,
      };

      activeTeamSockets.forEach((sid) =>
        io.to(sid).emit("guess:correct", payload)
      );

      cb?.({ ok: true, ...payload });

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
      console.error("guess:text failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to submit guess" });
    }
  });

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

        if (isRoundRunning(room) && room.round?.clueGiverId === socket.id) {
          room.round.clueGiverId = null;

          if (!room.round.clue) {
            const newGiver = pickNewClueGiver(room);
            if (newGiver) {
              console.log(`Reassigned cluegiver to ${newGiver.name}`);
              emitRoundSync(room);
            } else {
              console.log("No replacement cluegiver - ending round");
              endRound(room, "disconnected");
            }
          }
        }

        emitRoomSync(room);
        break;
      }
    } catch (err) {
      console.error("Disconnect handler error:", err);
    }

    console.log("Disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
