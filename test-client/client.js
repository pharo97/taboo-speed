// test-client/client.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";
const SETTINGS = { targetScore: 9999, roundSeconds: 12 };

const host = io(SERVER_URL, { transports: ["websocket"] });
let player2 = null;

let roomCode = null;

let hostToken = null;
let player2Token = null;

let hostState = null;
let player2State = null;

let roundRunning = false;
let activeTeam = null;
let clueGiverId = null;
let clueGiverToken = null;

let guessInterval = null;
let exiting = false;

let didNonHostStartTest = false;
let didStartTwiceTest = false;
let didBadClueTest = false;
let didWrongTeamTest = false;
let didDuplicateTest = false;
let didGuessAfterEndTest = false;
let didMidRoundReconnectTest = false;

let lastAttemptedTileId = null;

let hostRoundNumber = null;
let p2RoundNumber = null;

let hostDidRoundInit = false;
let p2DidRoundInit = false;

// --- reconnect verification flags ---
let p2SawRoundSyncAfterReconnect = false;
let p2SawRoomSyncAfterReconnect = false;
let reconnectingNow = false;

function log(...args) {
  console.log(...args);
}

function tokenFromRes(res) {
  return res?.playerToken || res?.playerKey || null;
}

const failsafeTimer = setTimeout(() => {
  log("🧯 Failsafe exit: test took too long. Shutting down.");
  shutdown(1);
}, 45000);

function stopGuessLoop() {
  if (guessInterval) clearInterval(guessInterval);
  guessInterval = null;
}

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;

  try {
    clearTimeout(failsafeTimer);
  } catch {}
  try {
    stopGuessLoop();
  } catch {}

  try {
    host.removeAllListeners();
    host.disconnect();
  } catch {}
  try {
    player2?.removeAllListeners();
    player2?.disconnect();
  } catch {}

  setTimeout(() => process.exit(code), 100);
}

function freshestState() {
  return hostState || player2State;
}

function pickUnGuessedTileId(state) {
  const guessed = state?.round?.guessed || {};
  const tiles = state?.round?.board || [];
  const unguessed = tiles.filter((t) => !guessed[t.id]);
  return unguessed[0]?.id || null;
}

function getSocketForTeam(team) {
  if (team === "blue") return host;
  if (team === "red") return player2;
  return null;
}

function onNewRound(which, roundNum) {
  roundRunning = true;
  lastAttemptedTileId = null;

  if (which === "HOST") {
    hostRoundNumber = roundNum;
    hostDidRoundInit = false;
  } else {
    p2RoundNumber = roundNum;
    p2DidRoundInit = false;
  }
}

function applyGuessDeltaToState(state, delta) {
  if (!state) return state;
  if (!state.round) state.round = {};
  if (!state.round.guessed) state.round.guessed = {};

  state.round.guessed[delta.tileId] = {
    by: delta.by,
    team: delta.team,
    at: Date.now(),
    points: delta.points,
  };

  // Keep scores in sync if present in room state (server emits scores in delta)
  if (state.scores && delta.scores) {
    state.scores = delta.scores;
  }
  return state;
}

function runGuessAfterEndTestAndExit(reasonTag) {
  if (didGuessAfterEndTest) return;
  didGuessAfterEndTest = true;

  const state = freshestState();
  const tileId = state?.round?.board?.[0]?.id || "fake-tile-id";

  host.emit("guess:submit", { roomCode, tileId }, (r1) => {
    log(`🧪 TEST guess after end (${reasonTag}) [host]:`, r1);

    player2?.emit("guess:submit", { roomCode, tileId }, (r2) => {
      log(`🧪 TEST guess after end (${reasonTag}) [player2]:`, r2);
      stopGuessLoop();
      shutdown(0);
    });
  });
}

// small helper: emit with ack timeout
function emitWithTimeout(socket, event, payload, ms = 900) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ __timeout: true });
    }, ms);

    socket.emit(event, payload, (ack) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(ack);
    });
  });
}

// --- MID-ROUND reconnect test ---
async function midRoundReconnectTest() {
  if (didMidRoundReconnectTest) return;
  didMidRoundReconnectTest = true;

  if (!player2 || !player2Token) return;

  reconnectingNow = true;
  p2SawRoundSyncAfterReconnect = false;
  p2SawRoomSyncAfterReconnect = false;

  log("🔌 MID-ROUND reconnect: disconnecting Player2, then room:rejoin...");

  try {
    player2.disconnect();
  } catch {}

  await new Promise((r) => setTimeout(r, 250));

  const p2b = io(SERVER_URL, { transports: ["websocket"] });

  await new Promise((resolve, reject) => {
    p2b.on("connect", resolve);
    p2b.on("connect_error", reject);
  });

  log("✅ Player2(reconnected socket) connected:", p2b.id);

  // Rejoin (token-based)
  const ack = await emitWithTimeout(
    p2b,
    "room:rejoin",
    { roomCode, playerToken: player2Token, name: "PlayerTwo" },
    900
  );

  log("🔁 Reconnect ack:", ack);
  if (!ack?.ok) return shutdown(1);

  // Swap in the new socket as player2
  try {
    player2?.removeAllListeners();
  } catch {}
  player2 = p2b;
  wirePlayer2Listeners(); // flips p2SawRoomSyncAfterReconnect / p2SawRoundSyncAfterReconnect

  // Wait until we see BOTH room:sync + round:sync post-reconnect
  const start = Date.now();
  while (Date.now() - start < 2500) {
    if (p2SawRoomSyncAfterReconnect && p2SawRoundSyncAfterReconnect) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  if (!p2SawRoomSyncAfterReconnect || !p2SawRoundSyncAfterReconnect) {
    log("❌ Reconnect validation failed:", {
      p2SawRoomSyncAfterReconnect,
      p2SawRoundSyncAfterReconnect,
    });
    return shutdown(1);
  }

  reconnectingNow = false;
  log("✅ MID-ROUND reconnect validated: Player2 got room:sync + round:sync");
}

// ---- Host connect -> create room ----
host.on("connect", () => {
  log("✅ Host connected:", host.id);

  host.emit(
    "room:create",
    { name: "HostPlayer", password: "secret123", settings: SETTINGS },
    (res) => {
      log("📦 room:create:", res);
      if (!res?.ok) return shutdown(1);

      roomCode = res.roomCode;
      hostToken = tokenFromRes(res);

      host.emit("room:team:set", { roomCode, team: "blue" }, (r) => {
        log("🔵 Host set team:", r);
        if (!r?.ok) return shutdown(1);
        connectPlayer2();
      });
    }
  );
});

// ---- Player2 connect -> join ----
function wirePlayer2Listeners() {
  // NEW: room:sync
  player2.on("room:sync", (state) => {
    player2State = state;
    log("📡 Player2 room:sync status =", state.status);

    if (reconnectingNow) {
      p2SawRoomSyncAfterReconnect = true;
    }
  });

  // Back-compat
  player2.on("room:state", (state) => {
    player2State = state;
    log("📡 Player2 room:state status =", state.status);
  });

  // NEW: round:sync
  player2.on("round:sync", (payload) => {
    const rn = payload?.round?.number ?? null;
    if (rn !== p2RoundNumber) onNewRound("P2", rn);

    activeTeam = payload?.round?.activeTeam;
    clueGiverId = payload?.round?.clueGiverId;
    clueGiverToken = payload?.round?.clueGiverToken;

    // Keep local round state updated
    if (!player2State) player2State = {};
    player2State.round = payload.round;

    const hasPoints = payload?.round?.board?.some((t) => "points" in t);
    log(
      "🟢 round:sync (player2) round =",
      rn,
      "activeTeam =",
      activeTeam,
      "clueGiverId =",
      clueGiverId,
      "clueGiverToken =",
      clueGiverToken,
      "hasPoints=",
      hasPoints
    );

    if (reconnectingNow) {
      p2SawRoundSyncAfterReconnect = true;
    }

    if (!p2DidRoundInit) p2DidRoundInit = true;
  });

  // Back-compat
  player2.on("round:state", (payload) => {
    const rn = payload?.round?.number ?? null;
    if (rn !== p2RoundNumber) onNewRound("P2", rn);

    activeTeam = payload?.round?.activeTeam;
    clueGiverId = payload?.round?.clueGiverId;
    clueGiverToken = payload?.round?.clueGiverToken;

    if (!player2State) player2State = {};
    player2State.round = payload.round;

    const hasPoints = payload?.round?.board?.some((t) => "points" in t);
    log(
      "🟢 round:state (player2) round =",
      rn,
      "activeTeam =",
      activeTeam,
      "clueGiverId =",
      clueGiverId,
      "clueGiverToken =",
      clueGiverToken,
      "hasPoints=",
      hasPoints
    );
  });

  // NEW: clue:sync
  player2.on("clue:sync", (c) => log("🧩 Player2 saw clue:sync", c));
  // Back-compat
  player2.on("clue:state", (c) => log("🧩 Player2 saw clue:state", c));

  // NEW: guess delta
  player2.on("guess:applied", (g) => {
    log("✅ Player2 saw guess:applied", g);
    player2State = applyGuessDeltaToState(player2State, g);
  });
  // Back-compat
  player2.on("guess:result", (g) => log("✅ Player2 saw guess:result", g));

  player2.on("round:ended", (e) => {
    roundRunning = false;
    stopGuessLoop();
    log("🏁 Round ended (player2)", e || "");
    runGuessAfterEndTestAndExit("round");
  });

  player2.on("game:ended", (e) => {
    roundRunning = false;
    stopGuessLoop();
    log("🏆 Game ended (player2)", e || "");
    runGuessAfterEndTestAndExit("game");
  });

  player2.on("connect_error", (err) => {
    log("❌ Player2 connect error:", err.message);
    shutdown(1);
  });

  player2.on("error", (err) => {
    log("❌ Player2 socket error:", err?.message || err);
    shutdown(1);
  });
}

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

        player2Token = tokenFromRes(joinRes);

        wirePlayer2Listeners();

        player2.emit("room:team:set", { roomCode, team: "red" }, (r) => {
          log("🔴 Player2 set team:", r);
          if (!r?.ok) return shutdown(1);

          // TEST: non-host cannot start round
          if (!didNonHostStartTest) {
            didNonHostStartTest = true;
            player2.emit("round:start", { roomCode }, (rr) => {
              log("🧪 TEST non-host round:start:", rr);
              setTimeout(startRound, 150);
            });
          } else {
            setTimeout(startRound, 150);
          }
        });
      }
    );
  });
}

// ---- Start round (host only) ----
function startRound() {
  log("🧪 emitting round:start with roomCode =", roomCode);

  host.emit("round:start", { roomCode }, (res) => {
    log("▶️ round:start:", res);
    if (!res?.ok) return shutdown(1);

    // TEST: starting again immediately should fail
    if (!didStartTwiceTest) {
      didStartTwiceTest = true;
      host.emit("round:start", { roomCode }, (r2) => {
        log("🧪 TEST start round twice:", r2);
      });
    }
  });
}

// ---- Host listeners ----

// NEW: room:sync
host.on("room:sync", (state) => {
  hostState = state;
  log("📡 Host room:sync status =", state.status);
});
// Back-compat
host.on("room:state", (state) => {
  hostState = state;
  log("📡 Host room:state status =", state.status);
});

// NEW: round:sync
host.on("round:sync", (payload) => {
  const rn = payload?.round?.number ?? null;
  if (rn !== hostRoundNumber) onNewRound("HOST", rn);

  activeTeam = payload?.round?.activeTeam;
  clueGiverId = payload?.round?.clueGiverId;
  clueGiverToken = payload?.round?.clueGiverToken;

  // Keep local round state updated
  if (!hostState) hostState = {};
  hostState.round = payload.round;

  const hasPoints = payload?.round?.board?.some((t) => "points" in t);
  log(
    "🟢 round:sync (host) round =",
    rn,
    "activeTeam =",
    activeTeam,
    "clueGiverId =",
    clueGiverId,
    "clueGiverToken =",
    clueGiverToken,
    "hasPoints=",
    hasPoints
  );

  if (!hostDidRoundInit) {
    hostDidRoundInit = true;

    // Bad clue test (once per run) BEFORE reconnect
    if (!didBadClueTest && player2) {
      didBadClueTest = true;
      player2.emit("clue:set", { roomCode, text: "BADCLUE" }, (r) => {
        log("🧪 TEST bad clue:set by player2:", r);
      });
    }

    // Reconnect immediately while round is running, then continue.
    setTimeout(async () => {
      try {
        await midRoundReconnectTest();

        // Now set clue after reconnect
        const clueSocket = clueGiverId === host.id ? host : player2;
        clueSocket?.emit("clue:set", { roomCode, text: "horse" }, (r) => {
          log("🧩 clue:set by cluegiver:", r);
        });

        // Start guessing only after reconnect is confirmed
        startAutoGuessing();
      } catch (e) {
        log("❌ midRoundReconnectTest threw:", e?.message || e);
        shutdown(1);
      }
    }, 300);
  }

  if (!hostDidRoundInit) hostDidRoundInit = true;
});

// Back-compat
host.on("round:state", (payload) => {
  const rn = payload?.round?.number ?? null;
  if (rn !== hostRoundNumber) onNewRound("HOST", rn);

  activeTeam = payload?.round?.activeTeam;
  clueGiverId = payload?.round?.clueGiverId;
  clueGiverToken = payload?.round?.clueGiverToken;

  if (!hostState) hostState = {};
  hostState.round = payload.round;

  const hasPoints = payload?.round?.board?.some((t) => "points" in t);
  log(
    "🟢 round:state (host) round =",
    rn,
    "activeTeam =",
    activeTeam,
    "clueGiverId =",
    clueGiverId,
    "clueGiverToken =",
    clueGiverToken,
    "hasPoints=",
    hasPoints
  );
});

// NEW: clue:sync
host.on("clue:sync", (c) => log("🧩 Host saw clue:sync", c));
// Back-compat
host.on("clue:state", (c) => log("🧩 Host saw clue:state", c));

// NEW: guess delta
host.on("guess:applied", (g) => {
  log("✅ Host saw guess:applied", g);
  hostState = applyGuessDeltaToState(hostState, g);
});
// Back-compat
host.on("guess:result", (g) => log("✅ Host saw guess:result", g));

host.on("round:ended", (e) => {
  roundRunning = false;
  stopGuessLoop();
  log("🏁 Round ended (host)", e || "");
  runGuessAfterEndTestAndExit("round");
});

host.on("game:ended", (e) => {
  roundRunning = false;
  stopGuessLoop();
  log("🏆 Game ended (host)", e || "");
  runGuessAfterEndTestAndExit("game");
});

host.on("connect_error", (err) => {
  log("❌ Host connect error:", err.message);
  shutdown(1);
});

host.on("error", (err) => {
  log("❌ Host socket error:", err?.message || err);
  shutdown(1);
});

// ---- Auto-guessing + abuse tests ----
function startAutoGuessing() {
  if (guessInterval) return;

  guessInterval = setInterval(() => {
    if (!roundRunning) return;
    if (reconnectingNow) return; // don't spam while reconnecting

    const state = freshestState();
    if (!state?.round?.board?.length) return;

    // wrong team test (once per run)
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

    const tileId = pickUnGuessedTileId(state);
    if (!tileId) return;

    if (tileId === lastAttemptedTileId) return;
    lastAttemptedTileId = tileId;

    const activeSocket = getSocketForTeam(activeTeam);
    if (!activeSocket) return;

    activeSocket.emit("guess:submit", { roomCode, tileId }, (r) => {
      if (r?.ok === false) {
        log("❌ active guess failed:", r);
        lastAttemptedTileId = null;
        return;
      }

      // duplicate guess test (once per run)
      if (!didDuplicateTest) {
        didDuplicateTest = true;
        activeSocket.emit("guess:submit", { roomCode, tileId }, (dup) => {
          log("🧪 TEST duplicate guess:", dup);
        });
      }

      lastAttemptedTileId = null;
    });
  }, 120);
}
