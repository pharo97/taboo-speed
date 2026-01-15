// server/rooms.js
const { loadWordBank } = require("./wordbank");

const rooms = {}; // roomCode -> room object

// --------------------
// ROOM STATUS CONSTANTS
// --------------------
const ROOM_STATUS = {
  LOBBY: "lobby",           // Waiting for host to start turn
  OFFER: "offer",           // Cluegiver being selected (offer pending)
  ACCEPTED: "accepted",     // Cluegiver accepted, waiting to start
  RUNNING: "running",       // Round active
  ROUND_END: "round_end",   // Brief transition after round ends
  ENDED: "ended",           // Game over (target score reached)
};

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

function clamp(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.min(Math.max(x, min), max);
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
// ROOM MANAGEMENT (Among Us style: CODE ONLY)
// --------------------
function createRoom({ settings } = {}) {
  let code = generateRoomCode();
  while (rooms[code]) code = generateRoomCode();

  const targetScore = clamp(settings?.targetScore ?? 300, 50, 10000);
  const roundSeconds = clamp(settings?.roundSeconds ?? 30, 10, 300);

  const now = Date.now();

  rooms[code] = {
    code,
    settings: {
      targetScore,
      roundSeconds,
    },

    status: "lobby",

    createdAt: now,
    lastActivity: now,

    // identity maps used by index.js
    playersByToken: {}, // token -> player (server truth)
    tokenBySocketId: {}, // socketId -> token
    hostPlayerToken: null, // token

    scores: { blue: 0, red: 0 },
    turn: { nextTeam: "blue" },

    round: {
      number: 0,
      activeTeam: null,
      clueGiverId: null,
      clueGiverToken: null,
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
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  return rooms[key] || null;
}

// --------------------
// SANITIZE (SEND TO CLIENT)
// IMPORTANT:
// - do NOT leak player tokens or socket ids
// - BUT App.jsx expects playersByToken[playerToken] to exist client-side
//   so we keep a token-keyed map with safe player objects (no token/socketId)
// --------------------
function sanitizeRoom(room) {
  if (!room) return null;

  const {
    runtime, // hide (internal timers)
    tokenBySocketId, // hide (internal)
    ...safe
  } = room;

  // Keep token-keyed map but strip sensitive fields
  const safePlayersByToken = {};
  for (const [token, p] of Object.entries(room.playersByToken || {})) {
    safePlayersByToken[token] = {
      name: p.name,
      team: p.team,
      isHost: !!p.isHost,
      connected: !!p.connected,
      lastSeenAt: p.lastSeenAt,
    };
  }

  return {
    ...safe,
    tokenBySocketId: undefined,
    runtime: undefined,

    // keep hostPlayerToken hidden
    hostPlayerToken: undefined,

    // provide safe token-keyed map for UI (needed to identify "me")
    playersByToken: safePlayersByToken,

    // optional summary helpers
    playerCount: Object.keys(safePlayersByToken).length,
    connectedCount: Object.values(safePlayersByToken).filter((p) => p.connected)
      .length,
  };
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  sanitizeRoom,
  generateBoard,
  ROOM_STATUS,
};
