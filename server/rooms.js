const rooms = {}; // roomCode -> room object

function generateRoomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function createRoom({ password, settings }) {
  let code = generateRoomCode();
  while (rooms[code]) code = generateRoomCode();

  rooms[code] = {
    code,
    password, // MVP only (plain). We'll hash with bcrypt next.
    settings: {
      targetScore: settings?.targetScore ?? 300,
      roundSeconds: settings?.roundSeconds ?? 30,
    },
    status: "lobby",
    createdAt: Date.now(),
    hostPlayerId: null,
    players: {}, // socketId -> player object
    scores: { blue: 0, red: 0 },
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

module.exports = {
  rooms,
  createRoom,
  getRoom,
  addPlayer,
};
