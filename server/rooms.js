// server/rooms.js
const { loadWordBank } = require("./wordbank");

const rooms = {}; // roomCode -> room object

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
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, n);
  for (const c of chosen) usedSet.add(c.word.toLowerCase());
  return chosen;
}

// ✅ fallback-safe board generator
function generateBoard(total = 24) {
  const bank = loadWordBank();

  const easy = bank.filter((w) => w.difficulty === "easy");
  const medium = bank.filter((w) => w.difficulty === "medium");
  const hard = bank.filter((w) => w.difficulty === "hard");

  const used = new Set();

  // desired mix
  let wantEasy = 8;
  let wantMedium = 8;
  let wantHard = 8;

  // if total changes, keep ratio-ish
  if (total !== 24) {
    wantEasy = Math.round(total / 3);
    wantMedium = Math.round(total / 3);
    wantHard = total - wantEasy - wantMedium;
  }

  const board = [];

  // take as many as possible from each bucket
  board.push(...pickRandom(easy, Math.min(wantEasy, easy.length), used));
  board.push(...pickRandom(medium, Math.min(wantMedium, medium.length), used));
  board.push(...pickRandom(hard, Math.min(wantHard, hard.length), used));

  // fill remaining slots from combined pool (fallback)
  const remaining = total - board.length;
  if (remaining > 0) {
    const combined = [...hard, ...medium, ...easy]; // bias hard first if available
    board.push(...pickRandom(combined, remaining, used));
  }

  if (board.length < total) {
    throw new Error(
      `Not enough words for board: need ${total}, have ${board.length}`
    );
  }

  // convert to board tiles
  return board.map((w, idx) => ({
    id: `${Date.now()}-${idx}`,
    word: w.word,
    difficulty: w.difficulty,
    points: w.points,
  }));
}

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
  players: {},
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
  },

  runtime: {
    roundIntervalId: null,
    roundTimeoutId: null,
  },
};

  return rooms[code];
}

function getRoom(code) {
  return rooms[code];
}

function addPlayer(room, player) {
  room.players[player.id] = player;

  if (!room.hostPlayerId) {
    room.hostPlayerId = player.id;
    room.players[player.id].isHost = true;
  }

  return room.players[player.id];
}

function sanitizeRoom(room) {
  const { password, runtime, ...safe } = room;
  return safe;
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  addPlayer,
  sanitizeRoom,
  generateBoard,
};
