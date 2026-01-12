// server/rooms.js
const { loadWordBank } = require("./wordbank");

const rooms = {}; // roomCode -> room object

// --------------------
// UTILITIES
// --------------------
function generateRoomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function pickRandom(arr, n, usedSet) {
  const pool = arr.filter((x) => !usedSet.has(x.word.toLowerCase()));

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chosen = pool.slice(0, n);
  for (const c of chosen) usedSet.add(c.word.toLowerCase());
  return chosen;
}

// --------------------
// BOARD GENERATION
// --------------------
function generateBoard(total = 24) {
  const bank = loadWordBank();
  if (!Array.isArray(bank) || bank.length === 0) {
    throw new Error("Word bank is empty");
  }

  const easy = bank.filter((w) => w.difficulty === "easy");
  const medium = bank.filter((w) => w.difficulty === "medium");
  const hard = bank.filter((w) => w.difficulty === "hard");

  const used = new Set();

  let wantEasy = 8;
  let wantMedium = 8;
  let wantHard = 8;

  if (total !== 24) {
    wantEasy = Math.round(total / 3);
    wantMedium = Math.round(total / 3);
    wantHard = total - wantEasy - wantMedium;
  }

  const board = [];
  board.push(...pickRandom(easy, Math.min(wantEasy, easy.length), used));
  board.push(...pickRandom(medium, Math.min(wantMedium, medium.length), used));
  board.push(...pickRandom(hard, Math.min(wantHard, hard.length), used));

  const remaining = total - board.length;
  if (remaining > 0) {
    const combined = [...hard, ...medium, ...easy];
    board.push(...pickRandom(combined, remaining, used));
  }

  if (board.length < total) {
    throw new Error(
      `Not enough words for board: need ${total}, have ${board.length}`
    );
  }

  const pointsByDifficulty = { easy: 5, medium: 10, hard: 15 };
  const ts = Date.now();

  return board.map((w, idx) => ({
    id: `${ts}-${idx}`,
    word: w.word,
    difficulty: w.difficulty,
    points: pointsByDifficulty[w.difficulty] ?? 10,
  }));
}

// --------------------
// ROOM MANAGEMENT
// --------------------
function createRoom({ password, settings }) {
  let code = generateRoomCode();
  while (rooms[code]) code = generateRoomCode();

  rooms[code] = {
    code,
    password,
    settings: {
      targetScore: settings?.targetScore ?? 300,
      roundSeconds: settings?.roundSeconds ?? 30,
    },
    status: "lobby",
    createdAt: Date.now(),

    hostPlayerId: null,

    // socketId -> player
    players: {},

    // playerKey -> socketId
    playersByKey: {},

    scores: { blue: 0, red: 0 },
    turn: { nextTeam: "blue" },

    round: {
      number: 0,
      activeTeam: null,
      clueGiverId: null,
      startedAt: null,
      endsAt: null,
      board: [],
      guessed: {},
      clue: null,
    },

    runtime: {
      roundIntervalId: null,
      roundTimeoutId: null,
      roundRunning: false,
    },
  };

  return rooms[code];
}

function getRoom(code) {
  return rooms[code];
}

function touchPlayer(player) {
  player.lastSeenAt = Date.now();
}

// Old behavior (socket-id only). Keep exported so current code doesn’t explode.
function addPlayer(room, player) {
  room.players[player.id] = player;

  if (!room.hostPlayerId) {
    room.hostPlayerId = player.id;
    room.players[player.id].isHost = true;
  }

  touchPlayer(room.players[player.id]);
  return room.players[player.id];
}

// New behavior: reconnect via playerKey
function addOrReconnectPlayer(
  room,
  { socketId, name, playerKey, isHost = false }
) {
  if (!playerKey) throw new Error("playerKey required");

  const existingSocketId = room.playersByKey[playerKey];
  const existingPlayer = existingSocketId
    ? room.players[existingSocketId]
    : null;

  // Reconnect: same identity, new socket id
  if (existingPlayer) {
    // remove old socket mapping
    delete room.players[existingSocketId];

    // carry forward team/host status by default
    const merged = {
      ...existingPlayer,
      id: socketId,
      name: (name || existingPlayer.name || "Player").trim(),
      connected: true,
      playerKey,
    };

    room.players[socketId] = merged;
    room.playersByKey[playerKey] = socketId;

    // if host was on old socket id, move hostPlayerId
    if (room.hostPlayerId === existingSocketId) {
      room.hostPlayerId = socketId;
      room.players[socketId].isHost = true;
    }

    touchPlayer(room.players[socketId]);
    return { player: room.players[socketId], reconnected: true };
  }

  // Fresh join
  const player = {
    id: socketId,
    name: (name || "Player").trim(),
    team: null,
    isHost: !!isHost,
    connected: true,
    playerKey,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  room.players[socketId] = player;
  room.playersByKey[playerKey] = socketId;

  if (!room.hostPlayerId) {
    room.hostPlayerId = socketId;
    room.players[socketId].isHost = true;
  }

  touchPlayer(room.players[socketId]);
  return { player: room.players[socketId], reconnected: false };
}

function markDisconnected(room, socketId) {
  const p = room.players?.[socketId];
  if (!p) return;

  p.connected = false;
  touchPlayer(p);
}

function removePlayerByKey(room, playerKey) {
  const socketId = room.playersByKey?.[playerKey];
  if (!socketId) return false;

  const wasHost = room.hostPlayerId === socketId;

  delete room.playersByKey[playerKey];
  delete room.players[socketId];

  // If host got kicked, pick a new host if possible
  if (wasHost) {
    const remaining = Object.values(room.players || {});
    const next = remaining[0];
    room.hostPlayerId = next ? next.id : null;
    if (next) next.isHost = true;
  }

  return true;
}

// --------------------
// SANITIZE (SEND TO CLIENT)
// --------------------
function sanitizeRoom(room) {
  const { password, runtime, ...safe } = room;

  // Hide playerKey mapping from clients (still show connected status + name/team)
  if (safe.playersByKey) delete safe.playersByKey;

  return safe;
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  addPlayer, // kept for backward compatibility
  addOrReconnectPlayer,
  markDisconnected,
  removePlayerByKey,
  touchPlayer,
  sanitizeRoom,
  generateBoard,
};
