// test-client/client.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";

// Make tests fast
const SETTINGS = {
  targetScore: 25, // low so we can hit game:ended quickly
  roundSeconds: 12,
};

const host = io(SERVER_URL, { transports: ["websocket"] });
let roomCode = null;

let player2 = null;

let hostState = null;
let player2State = null;

let roundRunning = false;
let activeTeam = null;
let clueGiverId = null;
let board = [];

let guessInterval = null;

let didWrongTeamTest = false;
let didDuplicateTest = false;
let didBadClueTest = false;

// ---- helpers ----
function log(...args) {
  console.log(...args);
}

function shutdown(code = 0) {
  try {
    if (guessInterval) clearInterval(guessInterval);
  } catch {}

  try {
    host.removeAllListeners();
    host.disconnect();
  } catch {}

  try {
    player2?.removeAllListeners();
    player2?.disconnect();
  } catch {}

  setTimeout(() => process.exit(code), 150);
}

// failsafe
setTimeout(() => {
  log("🧯 Failsafe exit: test took too long. Shutting down.");
  shutdown(1);
}, 30000);

function pickUnGuessedTileId(state) {
  const guessed = state?.round?.guessed || {};
  const tiles = state?.round?.board || [];
  const unguessed = tiles.filter((t) => !guessed[t.id]);
  return unguessed[0]?.id || null;
}

function getSocketForTeam(team) {
  // host is blue in this test, player2 is red
  if (team === "blue") return host;
  if (team === "red") return player2;
  return null;
}

// ---- Host connect -> create room ----
host.on("connect", () => {
  log("✅ Host connected:", host.id);

  host.emit(
    "room:create",
    {
      name: "HostPlayer",
      password: "secret123",
      settings: SETTINGS,
    },
    (res) => {
      log("📦 room:create:", res);
      if (!res?.ok) return shutdown(1);

      roomCode = res.roomCode;

      host.emit("room:team:set", { roomCode, team: "blue" }, (r) => {
        log("🔵 Host set team:", r);
        if (!r?.ok) return shutdown(1);
        connectPlayer2();
      });
    }
  );
});

// ---- Player2 connect -> join ----
function connectPlayer2() {
  player2 = io(SERVER_URL, { transports: ["websocket"] });

  player2.on("connect", () => {
    log("✅ Player2 connected:", player2.id);

    player2.emit(
      "room:join",
      { roomCode, name: "PlayerTwo", password: "secret123" },
      (joinRes) => {
        log("👤 Player2 join:", joinRes);
        if (!joinRes?.ok) return shutdown(1);

        player2.emit("room:team:set", { roomCode, team: "red" }, (r) => {
          log("🔴 Player2 set team:", r);
          if (!r?.ok) return shutdown(1);

          // start round
          setTimeout(startRound, 250);
        });
      }
    );
  });

  // player2 listeners
  player2.on("room:state", (state) => {
    player2State = state;
    log("📡 Player2 room:state status =", state.status);
  });

  player2.on("round:state", (payload) => {
    roundRunning = true;
    activeTeam = payload?.round?.activeTeam;
    clueGiverId = payload?.round?.clueGiverId;
    board = payload?.round?.board || [];
    log(
      "🟢 round:state (player2) round =",
      payload?.round?.number,
      "activeTeam =",
      activeTeam
    );
  });

  player2.on("round:tick", (t) => {
    const sec = Math.ceil(t.remainingMs / 1000);
    if (sec <= 0) return;
    log("⏱ Player2 tick:", sec);
  });

  player2.on("guess:result", (g) => {
    log("✅ Player2 saw guess:result", g);
  });

  player2.on("clue:state", (c) => {
    log("🧩 Player2 saw clue:state", c);
  });

  player2.on("round:ended", (e) => {
    roundRunning = false;
    log("🏁 Round ended (player2)", e || "");
  });

  player2.on("game:ended", (e) => {
    log("🏆 Game ended (player2)", e || "");
    setTimeout(() => shutdown(0), 300);
  });

  player2.on("connect_error", (err) => {
    log("❌ Player2 connect error:", err.message);
    shutdown(1);
  });
}

// ---- Start round (host only) ----
function startRound() {
  log("🧪 emitting round:start with roomCode =", roomCode);

  host.emit("round:start", { roomCode }, (res) => {
    log("▶️ round:start:", res);
    if (!res?.ok) return shutdown(1);
  });
}

// ---- Host listeners ----
host.on("room:state", (state) => {
  hostState = state;
  log("📡 Host room:state status =", state.status);
});

host.on("round:state", (payload) => {
  roundRunning = true;
  activeTeam = payload?.round?.activeTeam;
  clueGiverId = payload?.round?.clueGiverId;
  board = payload?.round?.board || [];

  log(
    "🟢 round:state (host) round =",
    payload?.round?.number,
    "activeTeam =",
    activeTeam
  );

  // 1) Bad clue test: player2 tries to set clue (should fail unless player2 is cluegiver)
  if (!didBadClueTest) {
    didBadClueTest = true;
    player2.emit("clue:set", { roomCode, text: "BADCLUE", count: 2 }, (r) => {
      log("🧪 TEST bad clue:set by player2:", r);
    });
  }

  // 2) Proper clue set by cluegiver
  const clueSocket = clueGiverId === host.id ? host : player2;
  clueSocket.emit("clue:set", { roomCode, text: "test", count: 3 }, (r) => {
    log("🧩 clue:set by cluegiver:", r);
  });

  // Start auto-guess loop
  startAutoGuessing();
});

host.on("round:tick", (t) => {
  const sec = Math.ceil(t.remainingMs / 1000);
  if (sec <= 0) return;
  log("⏱ Host tick:", sec);
});

host.on("guess:result", (g) => {
  log("✅ Host saw guess:result", g);
});

host.on("clue:state", (c) => {
  log("🧩 Host saw clue:state", c);
});

host.on("round:ended", (e) => {
  roundRunning = false;
  log("🏁 Round ended (host)", e || "");
});

host.on("game:ended", (e) => {
  log("🏆 Game ended (host)", e || "");
});

host.on("connect_error", (err) => {
  log("❌ Host connect error:", err.message);
  shutdown(1);
});

// ---- Auto-guessing + abuse tests ----
function startAutoGuessing() {
  if (guessInterval) return; // already running

  guessInterval = setInterval(() => {
    if (!roundRunning) return;

    // Use freshest room state we have
    const state = hostState || player2State;
    if (!state?.round?.board?.length) return;

    // 1) Wrong team test: let the non-active team try to guess (should fail)
    if (!didWrongTeamTest && activeTeam) {
      didWrongTeamTest = true;
      const wrongTeam = activeTeam === "blue" ? "red" : "blue";
      const wrongSocket = getSocketForTeam(wrongTeam);

      const tileId = pickUnGuessedTileId(state);
      if (wrongSocket && tileId) {
        wrongSocket.emit("guess:submit", { roomCode, tileId }, (r) => {
          log("🧪 TEST wrong-team guess:", r);
        });
      }
    }

    // 2) Correct guess by active team
    const tileId = pickUnGuessedTileId(state);
    if (!tileId) return;

    const activeSocket = getSocketForTeam(activeTeam);
    if (!activeSocket) return;

    activeSocket.emit("guess:submit", { roomCode, tileId }, (r) => {
      // r is callback; server also emits guess:result
      if (r?.ok === false) log("❌ active guess failed:", r);

      // 3) Duplicate guess test: guess same tile again (should fail)
      if (!didDuplicateTest) {
        didDuplicateTest = true;
        activeSocket.emit("guess:submit", { roomCode, tileId }, (dup) => {
          log("🧪 TEST duplicate guess:", dup);
        });
      }
    });
  }, 300);
}
