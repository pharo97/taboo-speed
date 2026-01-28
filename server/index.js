// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");

const {
  createRoom,
  getRoom,
  generateBoard,
  rooms,
  ROOM_STATUS,
} = require("./rooms");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());

app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);

const allowedOrigins = [
  "https://taboo-reborn.vercel.app",
  "http://localhost:5173", // local dev (Vite default)
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// --------------------
// Room cleanup
// --------------------
function cleanupInactiveRooms() {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  for (const [code, room] of Object.entries(rooms)) {
    ensureIdentity(room);
    ensureRuntime(room);
    ensureRound(room);

    const allDisconnected = Object.values(room.playersByToken || {}).every(
      (p) => !p.connected,
    );

    const inactive =
      now - (room.lastActivity || room.createdAt) > THIRTY_MINUTES;

    if (allDisconnected && inactive) {
      console.log(`Cleaning up inactive room: ${code}`);
      clearRoundTimers(room);
      clearOfferTimer(room);
      delete rooms[code];
    }
  }
}

// Check every 30 seconds instead of 5 minutes
setInterval(cleanupInactiveRooms, 30 * 1000);

// --------------------
// helpers / guards
// --------------------
function getSocketById(id) {
  try {
    return io.sockets.sockets.get(id) || null;
  } catch {
    return null;
  }
}

function ensureRuntime(room) {
  room.runtime ||= {
    roundIntervalId: null,
    roundTimeoutId: null,
    roundRunning: false,
    offerTimeoutId: null,
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
    offer: null, // pending|accepted
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

  if (typeof room.settings.roundSeconds !== "number")
    room.settings.roundSeconds = 30;
  if (typeof room.settings.targetScore !== "number")
    room.settings.targetScore = 300;
}

function ensureRotation(room) {
  room.rotation ||= { blueIdx: 0, redIdx: 0 };
}

function ensureOffer(room) {
  ensureRound(room);
  if (!("offer" in room.round)) room.round.offer = null;
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
  if (room.status === ROOM_STATUS.RUNNING && room.runtime?.roundRunning) {
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

function clearOfferTimer(room) {
  ensureRuntime(room);
  if (room.runtime.offerTimeoutId) {
    clearTimeout(room.runtime.offerTimeoutId);
    room.runtime.offerTimeoutId = null;
  }
}

function isRoundRunning(room) {
  return (
    room?.status === ROOM_STATUS.RUNNING && room?.runtime?.roundRunning === true
  );
}

// --------------------
// STATE VALIDATION
// --------------------
function validateRoomState(room, allowedStatuses) {
  if (!Array.isArray(allowedStatuses)) {
    allowedStatuses = [allowedStatuses];
  }
  return allowedStatuses.includes(room.status);
}

function resetRoundState(room) {
  ensureRound(room);
  const prevNumber = room.round.number || 0;

  room.round = {
    number: prevNumber,
    activeTeam: null,
    clueGiverId: null,
    clueGiverToken: null,
    startedAt: null,
    endsAt: null,
    board: [],
    guessed: {},
    clue: null,
    offer: null,
  };

  clearRoundTimers(room);
  clearOfferTimer(room);
}

function allTilesGuessed(room) {
  const total = room?.round?.board?.length || 0;
  const guessedCount = Object.keys(room?.round?.guessed || {}).length;
  return total > 0 && guessedCount >= total;
}

// --------------------
// Host transfer logic
// --------------------
function getConnectedPlayerTokens(room, excludeToken = null) {
  ensureIdentity(room);
  return Object.entries(room.playersByToken || {})
    .filter(
      ([token, p]) => p && p.connected && p.socketId && token !== excludeToken,
    )
    .map(([token]) => token);
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function setHost(room, newHostToken) {
  ensureIdentity(room);

  const oldHostToken = room.hostPlayerToken;
  if (oldHostToken && room.playersByToken[oldHostToken]) {
    room.playersByToken[oldHostToken].isHost = false;
  }

  room.hostPlayerToken = newHostToken || null;

  if (newHostToken && room.playersByToken[newHostToken]) {
    room.playersByToken[newHostToken].isHost = true;
  }

  room.lastActivity = Date.now();
}

function ensureValidHost(room) {
  ensureIdentity(room);

  if (!room.hostPlayerToken || !room.playersByToken[room.hostPlayerToken]) {
    const candidate = pickRandom(getConnectedPlayerTokens(room));
    if (candidate) setHost(room, candidate);
    return;
  }

  const host = room.playersByToken[room.hostPlayerToken];
  if (!host.connected || !host.socketId) {
    const candidate = pickRandom(
      getConnectedPlayerTokens(room, room.hostPlayerToken),
    );
    if (candidate) setHost(room, candidate);
  }
}

function maybeTransferHostIfNeeded(room, departingToken = null) {
  ensureIdentity(room);

  const hostToken = room.hostPlayerToken;
  const hostMissing = !hostToken || !room.playersByToken[hostToken];

  if (hostMissing || hostToken === departingToken) {
    const candidate = pickRandom(
      getConnectedPlayerTokens(room, departingToken),
    );
    if (candidate) setHost(room, candidate);
  } else {
    ensureValidHost(room);
  }
}

// --------------------
// Cluegiver rotation + offer flow
// --------------------
function getTeamOrder(room, team) {
  ensureIdentity(room);

  return Object.entries(room.playersByToken || {})
    .map(([token, p]) => ({
      token,
      ...p,
      joinedAt: p.joinedAt || 0,
    }))
    .filter((p) => p.team === team)
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

function hasConnectedPlayers(room, team) {
  ensureIdentity(room);
  return Object.values(room.playersByToken || {}).some(
    (p) => p.team === team && p.connected && p.socketId,
  );
}

function pickNextCluegiverToken(room, team) {
  ensureRotation(room);
  const order = getTeamOrder(room, team);
  if (order.length === 0) return null;

  const idxKey = team === "blue" ? "blueIdx" : "redIdx";
  const startIdx = room.rotation[idxKey] % order.length;

  for (let step = 0; step < order.length; step++) {
    const i = (startIdx + step) % order.length;
    const p = order[i];
    if (p.connected && p.socketId) {
      room.rotation[idxKey] = (i + 1) % order.length;
      return p.token;
    }
  }

  return null;
}

function sendCluegiverOffer(room, team) {
  ensureOffer(room);
  ensureRuntime(room);
  ensureTurn(room);

  clearOfferTimer(room);

  // Check if this team has any connected players
  if (!hasConnectedPlayers(room, team)) {
    console.log(
      `Team ${team} has no connected players - auto-skipping to other team`,
    );

    const otherTeam = team === "blue" ? "red" : "blue";

    // Check if other team has players
    if (!hasConnectedPlayers(room, otherTeam)) {
      console.log("Both teams offline - returning to lobby");
      room.status = ROOM_STATUS.LOBBY;
      room.round.offer = null;
      emitRoomSync(room);
      io.to(room.code).emit("game:paused", {
        roomCode: room.code,
        reason: "Both teams offline",
      });
      return { ok: false, error: "Both teams offline" };
    }

    // Auto-skip to other team
    room.turn.nextTeam = otherTeam;
    return sendCluegiverOffer(room, otherTeam);
  }

  const offeredToken = pickNextCluegiverToken(room, team);
  if (!offeredToken) {
    // This shouldn't happen since we checked hasConnectedPlayers, but handle it
    room.status = ROOM_STATUS.LOBBY;
    room.round.offer = null;
    emitRoomSync(room);
    return { ok: false, error: `No connected ${team} players` };
  }

  const offered = room.playersByToken?.[offeredToken];
  if (!offered?.socketId) {
    room.status = ROOM_STATUS.LOBBY;
    room.round.offer = null;
    emitRoomSync(room);
    return { ok: false, error: "Offered player missing socket" };
  }

  room.round.offer = {
    team,
    offeredToken,
    acceptedToken: null,
    status: "pending",
    offeredAt: Date.now(),
    expiresAt: Date.now() + 15000,
  };

  // Set room status to OFFER when offer is sent
  room.status = ROOM_STATUS.OFFER;

  io.to(offered.socketId).emit("cluegiver:offer", {
    roomCode: room.code,
    team,
    offeredToken,
    expiresAt: room.round.offer.expiresAt,
  });

  room.lastActivity = Date.now();
  emitRoomSync(room);

  room.runtime.offerTimeoutId = setTimeout(() => {
    try {
      ensureOffer(room);
      if (!room.round.offer || room.round.offer.status !== "pending") return;

      const sameTeam = room.round.offer.team;
      room.round.offer = null;
      room.lastActivity = Date.now();

      // Auto-decline on timeout - send to next player
      const next = sendCluegiverOffer(room, sameTeam);
      if (!next.ok) {
        // No more players available - return to lobby
        room.status = ROOM_STATUS.LOBBY;
        emitRoomSync(room);
      }
    } catch (e) {
      console.error("Offer timeout handler error:", e);
    }
  }, 15000);

  return { ok: true, offeredToken };
}

// --------------------
// Start round NOW (only called by round:startAccepted)
// --------------------
function startRoundNow(room, clueGiverToken) {
  ensureRuntime(room);
  ensureRound(room);
  ensureScores(room);
  ensureTurn(room);
  ensureIdentity(room);
  ensureSettings(room);
  ensureOffer(room);

  clearRoundTimers(room);
  clearOfferTimer(room);

  const clueGiver = room.playersByToken?.[clueGiverToken];
  if (!clueGiver || !clueGiver.connected || !clueGiver.socketId) {
    return { ok: false, error: "Chosen cluegiver is not connected" };
  }

  const activeTeam = room.turn?.nextTeam || "blue";

  room.runtime.roundRunning = true;

  const startedAt = Date.now();
  const durationMs = (room.settings?.roundSeconds ?? 30) * 1000;
  const endsAt = startedAt + durationMs;

  room.round.number = (room.round.number || 0) + 1;
  room.round.activeTeam = activeTeam;

  room.round.clueGiverToken = clueGiverToken;
  room.round.clueGiverId = clueGiver.socketId;

  room.round.startedAt = startedAt;
  room.round.endsAt = endsAt;

  // Generate board with used words tracking
  const { board, usedWords } = generateBoard(24, room.usedWords || new Set());
  room.round.board = board;
  room.usedWords = usedWords; // Update room's used words

  room.round.guessed = {};
  room.round.clue = null;

  room.round.offer = null;

  room.status = ROOM_STATUS.RUNNING;
  room.turn.nextTeam = activeTeam === "blue" ? "red" : "blue";
  room.lastActivity = Date.now();

  emitRoomSync(room);
  emitRoundSync(room);

  const intervalId = setInterval(() => {
    const remainingMs = Math.max(0, room.round.endsAt - Date.now());
    io.to(room.code).emit("round:tick", { roomCode: room.code, remainingMs });

    if (remainingMs <= 0) {
      clearInterval(intervalId);
      endRound(room, "time");
    }
  }, 1000);

  room.runtime.roundIntervalId = intervalId;
  room.runtime.roundTimeoutId = setTimeout(
    () => endRound(room, "time"),
    durationMs + 50,
  );

  return { ok: true };
}

// --------------------
// Room sync payload
// --------------------
function buildRoomSyncPayload(room) {
  ensureIdentity(room);
  ensureScores(room);
  ensureTurn(room);
  ensureRound(room);
  ensureSettings(room);
  ensureValidHost(room);
  ensureOffer(room);

  const safePlayersByToken = {};
  for (const [token, p] of Object.entries(room.playersByToken || {})) {
    safePlayersByToken[token] = {
      token, // keep token for client mapping "me"
      name: p.name,
      team: p.team,
      isHost: !!p.isHost,
      connected: !!p.connected,
      lastSeenAt: p.lastSeenAt,
    };
  }

  return {
    code: room.code,
    status: room.status,
    settings: room.settings,
    scores: room.scores,
    turn: room.turn,
    hostPlayerToken: room.hostPlayerToken,
    winningTeam: room.winningTeam || null, // Include winning team for victory state

    round: {
      number: room.round.number,
      activeTeam: room.round.activeTeam,
      startedAt: room.round.startedAt,
      endsAt: room.round.endsAt,
      clueGiverId: room.round.clueGiverId,
      clueGiverToken: room.round.clueGiverToken,
      clue: room.round.clue,
      guessed: room.round.guessed,
      offer: room.round.offer || null,
    },

    playersByToken: safePlayersByToken,
  };
}

function buildRoundPayload(room, socketId) {
  ensureRound(room);
  const clueGiverSocketId = room.round?.clueGiverId || null;
  const isClueGiver = socketId && socketId === clueGiverSocketId;

  if (isClueGiver) {
    return {
      roomCode: room.code,
      round: {
        number: room.round.number,
        activeTeam: room.round.activeTeam,
        clueGiverId: room.round.clueGiverId,
        clueGiverToken: room.round.clueGiverToken,
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        board: room.round.board,
        guessed: room.round.guessed,
        clue: room.round.clue,
      },
      role: "cluegiver",
    };
  }

  return {
    roomCode: room.code,
    round: {
      number: room.round.number,
      activeTeam: room.round.activeTeam,
      clueGiverId: room.round.clueGiverId,
      clueGiverToken: room.round.clueGiverToken,
      startedAt: room.round.startedAt,
      endsAt: room.round.endsAt,
      board: [],
      guessed: room.round.guessed,
      clue: room.round.clue,
    },
    role: "guesser",
  };
}

// --------------------
// Emitters
// --------------------
function emitRoomSync(room, socketId = null) {
  const payload = buildRoomSyncPayload(room);
  if (socketId) io.to(socketId).emit("room:sync", payload);
  else io.to(room.code).emit("room:sync", payload);
}

function emitRoundSync(room, socketId = null) {
  ensureRound(room);
  const clueGiverSocketId = room.round?.clueGiverId || null;

  if (socketId) {
    io.to(socketId).emit("round:sync", buildRoundPayload(room, socketId));
    return;
  }

  if (clueGiverSocketId) {
    io.to(clueGiverSocketId).emit(
      "round:sync",
      buildRoundPayload(room, clueGiverSocketId),
    );
    io.to(room.code)
      .except(clueGiverSocketId)
      .emit("round:sync", buildRoundPayload(room, null));
  } else {
    io.to(room.code).emit("round:sync", buildRoundPayload(room, null));
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
      (x) => x.team === activeTeam && x.connected && x.socketId,
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
  ensureOffer(room);
  room.round.offer = null;
  clearOfferTimer(room);

  ensureScores(room);
  clearRoundTimers(room);

  // Transition to ROUND_END for 5 seconds to show full board reveal
  room.status = ROOM_STATUS.ROUND_END;
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

  // Auto-transition to lobby after 5 seconds
  setTimeout(() => {
    const currentRoom = getRoom(room.code);
    if (currentRoom && currentRoom.status === ROOM_STATUS.ROUND_END) {
      resetRoundState(currentRoom);
      currentRoom.status = ROOM_STATUS.LOBBY;
      currentRoom.lastActivity = Date.now();
      emitRoomSync(currentRoom);
      emitRoundSync(currentRoom);
    }
  }, 5000);
}

function endGame(room, winningTeam) {
  ensureRound(room);
  ensureOffer(room);
  room.round.offer = null;
  clearOfferTimer(room);

  ensureScores(room);
  clearRoundTimers(room);

  room.status = ROOM_STATUS.ENDED;
  room.winningTeam = winningTeam; // Track winning team for victory state
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

// Return room to lobby after game ends
function returnToLobby(room) {
  ensureRound(room);
  ensureScores(room);
  ensureOffer(room);
  ensureTurn(room);

  // Clear all game state
  clearRoundTimers(room);
  clearOfferTimer(room);

  // Reset game state but keep room intact
  room.status = ROOM_STATUS.LOBBY;
  room.scores = { blue: 0, red: 0 };
  room.winningTeam = null; // Clear victory state
  room.usedWords = new Set(); // Clear used words for new game
  room.round = {
    number: 0,
    activeTeam: null,
    clueGiverId: null,
    clueGiverToken: null,
    startedAt: null,
    endsAt: null,
    board: [],
    guessed: {},
    clue: null,
    offer: null,
  };
  room.turn = { nextTeam: "blue" };
  room.lastActivity = Date.now();

  // Players stay connected, teams preserved
  // Emit updated room state
  emitRoomSync(room);

  console.log(`Room ${room.code} returned to lobby`);
}

// --------------------
// Admin actions
// --------------------
function requireHost(room, socket) {
  ensureIdentity(room);
  const player = getPlayerBySocket(room, socket.id);
  if (!player) return { ok: false, error: "Player not in room" };
  if (room.hostPlayerToken !== player.token)
    return { ok: false, error: "Only host can do that" };
  return { ok: true, player };
}

// --------------------
// Socket handlers
// --------------------
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // CREATE ROOM
  socket.on("room:create", ({ name, settings }, cb) => {
    try {
      const room = createRoom({ settings });
      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);
      ensureRotation(room);
      ensureOffer(room);

      const token = newToken();

      room.playersByToken[token] = {
        token,
        socketId: socket.id,
        name: String(name || "Host")
          .trim()
          .slice(0, 40),
        team: null,
        joinedAt: Date.now(),
        isHost: true,
        connected: true,
        lastSeenAt: Date.now(),
      };

      setHost(room, token);

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      emitRoomSync(room);
      cb?.({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:create failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to create room" });
    }
  });

  // LEAVE ROOM
  socket.on("room:leave", ({ roomCode }, cb) => {
    try {
      const room = getRoom(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);

      const playerToken = room.tokenBySocketId?.[socket.id];
      if (!playerToken) return cb?.({ ok: false, error: "Not in room" });

      unbindSocket(room, socket.id);
      maybeTransferHostIfNeeded(room, playerToken);

      socket.leave(room.code);
      socket.data.roomCode = null;

      room.lastActivity = Date.now();
      emitRoomSync(room);

      cb?.({ ok: true });
    } catch (err) {
      console.error("room:leave failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to leave" });
    }
  });

  // JOIN ROOM
  socket.on("room:join", ({ roomCode, name }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);
      ensureRotation(room);
      ensureOffer(room);

      const token = newToken();

      room.playersByToken[token] = {
        token,
        socketId: socket.id,
        name: (name || "Player").trim().slice(0, 40),
        team: null,
        joinedAt: Date.now(),
        isHost: false,
        connected: true,
        lastSeenAt: Date.now(),
      };

      bindSocket(room, socket.id, token);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      ensureValidHost(room);

      emitRoomSync(room);
      cb?.({ ok: true, roomCode: room.code, playerToken: token });
    } catch (err) {
      console.error("room:join failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to join room" });
    }
  });

  // REJOIN ROOM
  socket.on("room:rejoin", ({ roomCode, playerToken, name }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);
      ensureRotation(room);
      ensureOffer(room);

      const p = room.playersByToken[playerToken];
      if (!p) return cb?.({ ok: false, error: "Invalid player token" });

      if (!p.joinedAt) p.joinedAt = Date.now();
      const cleanName = (name || "").trim();
      if (cleanName) p.name = cleanName.slice(0, 40);

      bindSocket(room, socket.id, playerToken);
      socket.join(room.code);
      socket.data.roomCode = room.code;

      ensureValidHost(room);

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

  // HOST-ONLY SETTINGS (lobby only)
  socket.on("room:settings:set", ({ roomCode, settings }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);
      ensureSettings(room);

      const gate = requireHost(room, socket);
      if (!gate.ok) return cb?.(gate);

      if (room.status !== "lobby") {
        return cb?.({
          ok: false,
          error: "Settings can only be changed in lobby",
        });
      }

      const roundSeconds = Number(settings?.roundSeconds);
      const targetScore = Number(settings?.targetScore);

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

  // TEAM SET
  socket.on("room:team:set", ({ roomCode, team }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      if (team !== "blue" && team !== "red")
        return cb?.({ ok: false, error: "Invalid team" });

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

  // HOST: kick player (host-only)
  socket.on("room:kick", ({ roomCode, targetToken, playerToken }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);
      ensureRuntime(room);
      ensureRound(room);
      ensureOffer(room);

      const caller = getPlayerBySocket(room, socket.id);
      if (!caller) return cb?.({ ok: false, error: "Player not in room" });
      if (room.hostPlayerToken !== caller.token)
        return cb?.({ ok: false, error: "Only host can kick" });

      const tt = String(targetToken || playerToken || "").trim();
      if (!tt) return cb?.({ ok: false, error: "Missing targetToken" });

      const target = room.playersByToken?.[tt];
      if (!target)
        return cb?.({
          ok: false,
          error: `Player not found (token=${tt.slice(0, 6)}...)`,
        });
      if (tt === room.hostPlayerToken)
        return cb?.({ ok: false, error: "Host cannot kick themselves" });

      // If target was offered cluegiver, clear offer
      if (
        room.round.offer?.status === "pending" &&
        room.round.offer.offeredToken === tt
      ) {
        room.round.offer = null;
        clearOfferTimer(room);
      }
      if (room.round.offer?.status === "accepted") {
        const accepted =
          room.round.offer.acceptedToken || room.round.offer.offeredToken;
        if (accepted === tt) {
          room.round.offer = null;
          clearOfferTimer(room);
        }
      }

      if (target.socketId) {
        io.to(target.socketId).emit("room:kicked", {
          roomCode: room.code,
          reason: "kicked",
        });

        const targetSocket = getSocketById(target.socketId);
        targetSocket?.leave(room.code);
        if (targetSocket) targetSocket.data.roomCode = null;

        if (room.tokenBySocketId?.[target.socketId]) {
          delete room.tokenBySocketId[target.socketId];
        }
      }

      if (room.round?.clueGiverToken === tt) {
        room.round.clueGiverToken = null;
        room.round.clueGiverId = null;
        room.round.clue = null;
      }

      delete room.playersByToken[tt];

      room.lastActivity = Date.now();
      emitRoomSync(room);
      emitRoundSync(room);

      cb?.({ ok: true });
    } catch (err) {
      console.error("room:kick failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to kick" });
    }
  });

  // HOST: transfer host (host-only)
  socket.on(
    "room:host:transfer",
    ({ roomCode, targetToken, playerToken }, cb) => {
      try {
        const rc = String(roomCode || "")
          .trim()
          .toUpperCase();
        const room = getRoom(rc);
        if (!room) return cb?.({ ok: false, error: "Room not found" });

        ensureIdentity(room);

        const caller = getPlayerBySocket(room, socket.id);
        if (!caller) return cb?.({ ok: false, error: "Player not in room" });
        if (room.hostPlayerToken !== caller.token)
          return cb?.({ ok: false, error: "Only host can transfer host" });

        const tt = String(targetToken || playerToken || "").trim();
        if (!tt) return cb?.({ ok: false, error: "Missing targetToken" });

        const target = room.playersByToken?.[tt];
        if (!target)
          return cb?.({
            ok: false,
            error: `Invalid target (token=${tt.slice(0, 6)}...)`,
          });
        if (!target.connected || !target.socketId)
          return cb?.({ ok: false, error: "Target must be connected" });

        setHost(room, tt);
        room.lastActivity = Date.now();

        emitRoomSync(room);
        io.to(room.code).emit("host:changed", {
          roomCode: room.code,
          hostToken: tt,
        });

        cb?.({ ok: true });
      } catch (err) {
        console.error("room:host:transfer failed:", err);
        cb?.({ ok: false, error: err?.message || "Failed to transfer host" });
      }
    },
  );

  // --------------------
  // cluegiver accept/decline + accepted start
  // --------------------

  socket.on("cluegiver:accept", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);
      ensureOffer(room);
      ensureRound(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      const offer = room.round.offer;
      if (!offer || offer.status !== "pending")
        return cb?.({ ok: false, error: "No pending offer" });
      if (offer.offeredToken !== player.token)
        return cb?.({ ok: false, error: "Not your offer" });

      // ✅ THIS was missing in your broken file
      offer.status = "accepted";
      offer.acceptedToken = player.token;

      clearOfferTimer(room);

      // Set room status to ACCEPTED
      room.status = ROOM_STATUS.ACCEPTED;
      room.lastActivity = Date.now();

      // Generate board NOW so cluegiver can see it before starting
      const { board, usedWords } = generateBoard(24, room.usedWords || new Set());
      room.round.board = board;
      room.usedWords = usedWords;

      room.round.clueGiverToken = player.token;
      room.round.clueGiverId = player.socketId;
      room.round.activeTeam = offer.team;

      emitRoomSync(room);
      // Send board to accepted cluegiver
      emitRoundSync(room, player.socketId);

      // Start a 30-second timeout - if cluegiver doesn't start, restart offer
      room.runtime.offerTimeoutId = setTimeout(() => {
        try {
          const currentRoom = getRoom(room.code);
          if (!currentRoom || currentRoom.status !== ROOM_STATUS.ACCEPTED)
            return;

          ensureOffer(currentRoom);
          if (
            !currentRoom.round.offer ||
            currentRoom.round.offer.status !== "accepted"
          )
            return;

          const team = currentRoom.round.offer.team;
          currentRoom.round.offer = null;
          currentRoom.lastActivity = Date.now();

          console.log(
            `Accepted cluegiver timeout - restarting offer for team ${team}`,
          );
          const next = sendCluegiverOffer(currentRoom, team);
          if (!next.ok) {
            currentRoom.status = ROOM_STATUS.LOBBY;
            emitRoomSync(currentRoom);
          }
        } catch (e) {
          console.error("Accepted timeout handler error:", e);
        }
      }, 30000);

      cb?.({ ok: true });
    } catch (err) {
      console.error("cluegiver:accept failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to accept offer" });
    }
  });

  socket.on("cluegiver:decline", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureIdentity(room);
      ensureOffer(room);
      ensureRotation(room);

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      const offer = room.round.offer;
      if (!offer) return cb?.({ ok: false, error: "No offer" });

      const isPending = offer.status === "pending";
      const isAccepted = offer.status === "accepted";
      if (!isPending && !isAccepted)
        return cb?.({ ok: false, error: "Offer not declinable" });

      const allowedToken = isAccepted
        ? offer.acceptedToken || offer.offeredToken
        : offer.offeredToken;

      if (allowedToken !== player.token)
        return cb?.({ ok: false, error: "Not your offer" });

      const team = offer.team;

      room.round.offer = null;
      clearOfferTimer(room);

      const next = sendCluegiverOffer(room, team);
      if (!next.ok) {
        // no one connected on that team
        emitRoomSync(room);
        return cb?.({
          ok: false,
          error: next.error || "No next cluegiver available",
        });
      }

      cb?.({ ok: true, pendingOffer: true, offer: room.round.offer });
    } catch (err) {
      console.error("cluegiver:decline failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to decline offer" });
    }
  });

  socket.on("round:startAccepted", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);
      ensureOffer(room);

      // Must be in ACCEPTED status to start
      if (room.status !== ROOM_STATUS.ACCEPTED) {
        return cb?.({ ok: false, error: "Must accept cluegiver role first" });
      }

      const player = getPlayerBySocket(room, socket.id);
      if (!player) return cb?.({ ok: false, error: "Player not in room" });

      const offer = room.round.offer;
      if (!offer || offer.status !== "accepted")
        return cb?.({ ok: false, error: "No accepted cluegiver yet" });

      const acceptedToken = offer.acceptedToken || offer.offeredToken;
      if (acceptedToken !== player.token)
        return cb?.({ ok: false, error: "Only accepted cluegiver can start" });

      const res = startRoundNow(room, player.token);
      cb?.(res);
    } catch (err) {
      console.error("round:startAccepted failed:", err);
      cb?.({
        ok: false,
        error: err?.message || "Failed to start accepted round",
      });
    }
  });

  // --------------------
  // round:start (host-only): ONLY sends offer, never starts round
  // --------------------
  socket.on("round:start", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      ensureRuntime(room);
      ensureRound(room);
      ensureScores(room);
      ensureTurn(room);
      ensureIdentity(room);
      ensureSettings(room);
      ensureRotation(room);
      ensureOffer(room);

      ensureValidHost(room);

      const gate = requireHost(room, socket);
      if (!gate.ok) return cb?.(gate);

      // If game ended, reset to lobby first (new game with 0/0 scores)
      if (room.status === ROOM_STATUS.ENDED) {
        returnToLobby(room);
      }

      // Can only start from LOBBY status (not from OFFER, ACCEPTED, RUNNING, etc.)
      if (
        !validateRoomState(room, [ROOM_STATUS.LOBBY, ROOM_STATUS.ROUND_END])
      ) {
        return cb?.({
          ok: false,
          error: `Can only start from lobby (current: ${room.status})`,
        });
      }

      const activeTeam = room.turn?.nextTeam || "blue";

      // If already pending/accepted, don't spam another offer
      if (
        room.round.offer?.status === "pending" ||
        room.round.offer?.status === "accepted"
      ) {
        return cb?.({
          ok: true,
          pendingOffer: true,
          message:
            room.round.offer.status === "accepted"
              ? "Cluegiver accepted. Waiting for them to start."
              : "Offer already pending. Waiting for accept.",
          offer: room.round.offer,
        });
      }

      // Send offer (NO auto-start fallback)
      const res = sendCluegiverOffer(room, activeTeam);
      if (!res.ok) {
        return cb?.({
          ok: false,
          error: res.error || "No cluegiver available",
        });
      }

      return cb?.({
        ok: true,
        pendingOffer: true,
        message: "Offer sent. Waiting for accept.",
        offer: room.round.offer,
      });
    } catch (err) {
      console.error("round:start failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to start round" });
    }
  });

  // --------------------
  // game:end (host-only): Force end the game
  // --------------------
  socket.on("game:end", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      const gate = requireHost(room, socket);
      if (!gate.ok) return cb?.(gate);

      ensureScores(room);

      // Determine winner based on current scores
      const winningTeam =
        room.scores.blue > room.scores.red
          ? "blue"
          : room.scores.red > room.scores.blue
            ? "red"
            : "tie";

      endGame(room, winningTeam);
      cb?.({ ok: true, winningTeam });
    } catch (err) {
      console.error("game:end failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to end game" });
    }
  });

  // Return to lobby (after game ends)
  socket.on("room:returnToLobby", ({ roomCode }, cb) => {
    try {
      const rc = String(roomCode || "").trim().toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      const gate = requireHost(room, socket);
      if (!gate.ok) return cb?.(gate);

      // Only allow if game has ended
      if (room.status !== ROOM_STATUS.ENDED) {
        return cb?.({ ok: false, error: "Can only return to lobby after game ends" });
      }

      returnToLobby(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:returnToLobby failed:", err);
      cb?.({ ok: false, error: err?.message || "Failed to return to lobby" });
    }
  });

  // clue:set
  socket.on("clue:set", ({ roomCode, text }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      if (!isRoundRunning(room)) {
        return cb?.({ ok: false, error: "No active round" });
      }

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

  // guess:text
  socket.on("guess:text", ({ roomCode, text }, cb) => {
    try {
      const rc = String(roomCode || "")
        .trim()
        .toUpperCase();
      const room = getRoom(rc);
      if (!room) return cb?.({ ok: false, error: "Room not found" });

      if (!isRoundRunning(room)) {
        return cb?.({ ok: false, error: "No active round" });
      }

      ensureRound(room);
      ensureScores(room);
      ensureIdentity(room);
      ensureSettings(room);

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
        (t) => t.word.toLowerCase() === guess && !room.round.guessed[t.id],
      );

      if (!tile) return cb?.({ ok: false, incorrect: true });

      // record guess
      room.round.guessed[tile.id] = {
        word: tile.word,
        points: tile.points,
        by: player.name,
        byToken: player.token,
        team: activeTeam,
        at: Date.now(),
      };

      // score update
      room.scores[activeTeam] += tile.points;
      room.lastActivity = Date.now();

      // ✅ IMPORTANT: always emit room:sync so scoreboard updates even if client misses guess:correct
      emitRoomSync(room);

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
        io.to(sid).emit("guess:correct", payload),
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
        ensureOffer(room);
        ensureRotation(room);

        const token = room.tokenBySocketId?.[socket.id];
        if (!token) continue;

        unbindSocket(room, socket.id);
        maybeTransferHostIfNeeded(room, token);

        // If the disconnecting player was offered OR accepted cluegiver, clear and advance
        if (room.round.offer) {
          const offer = room.round.offer;
          const team = offer.team;

          const affected =
            (offer.status === "pending" && offer.offeredToken === token) ||
            (offer.status === "accepted" &&
              (offer.acceptedToken || offer.offeredToken) === token);

          if (affected) {
            room.round.offer = null;
            clearOfferTimer(room);
            sendCluegiverOffer(room, team); // best effort
          }
        }

        // if cluegiver disconnected mid-round, handle
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
