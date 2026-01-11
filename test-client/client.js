// test-client/client.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";

// HOST SOCKET
const host = io(SERVER_URL, { transports: ["websocket"] });

let roomCode = null;
let player2 = null;

// round tracking to prevent "0 spam"
let hostRoundRunning = false;
let player2RoundRunning = false;

// prevent double-start
let startRequested = false;

// exit cleanup
function shutdown(code = 0) {
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

// failsafe: never hang forever
setTimeout(() => {
  console.log("🧯 Failsafe exit: test took too long. Shutting down.");
  shutdown(1);
}, 30000);

// --------------------
// HOST CONNECT + CREATE
// --------------------
host.on("connect", () => {
  console.log("✅ Host connected:", host.id);

  host.emit(
    "room:create",
    {
      name: "HostPlayer",
      password: "secret123",
      settings: { targetScore: 300, roundSeconds: 10 },
    },
    (res) => {
      console.log("📦 room:create:", res);
      if (!res?.ok) return shutdown(1);

      roomCode = res.roomCode;

      // host sets team
      host.emit("room:team:set", { roomCode, team: "blue" }, (r) => {
        console.log("🔵 Host set team:", r);
        connectPlayer2();
      });
    }
  );
});

// --------------------
// PLAYER2 CONNECT + JOIN
// --------------------
function connectPlayer2() {
  player2 = io(SERVER_URL, { transports: ["websocket"] });

  player2.on("connect", () => {
    console.log("✅ Player2 connected:", player2.id);

    player2.emit(
      "room:join",
      { roomCode, name: "PlayerTwo", password: "secret123" },
      (joinRes) => {
        console.log("👤 Player2 join:", joinRes);
        if (!joinRes?.ok) return shutdown(1);

        player2.emit("room:team:set", { roomCode, team: "red" }, (r) => {
          console.log("🔴 Player2 set team:", r);
          if (!r?.ok) return shutdown(1);

          // Start round once both teams are set
          setTimeout(startRoundOnce, 250);
        });
      }
    );
  });

  // --- player2 listeners ---
  player2.on("room:state", (state) => {
    console.log("📡 Player2 room:state status =", state.status);
  });

  player2.on("round:state", (payload) => {
    player2RoundRunning = true;
    console.log("🟢 round:state (player2) round =", payload?.round?.number);
  });

  player2.on("round:tick", (t) => {
    if (!player2RoundRunning) return;
    const sec = Math.ceil(t.remainingMs / 1000);
    if (sec <= 0) return; // don't spam 0
    console.log("⏱ Player2 tick:", sec);
  });

  player2.on("round:ended", (e) => {
    player2RoundRunning = false;
    console.log("🏁 Round ended (player2)", e || "");
    // Let host log too, then shutdown
    setTimeout(() => shutdown(0), 250);
  });

  player2.on("connect_error", (err) => {
    console.log("❌ Player2 connect error:", err.message);
    shutdown(1);
  });

  player2.on("error", (err) => {
    console.log("❌ Player2 socket error:", err?.message || err);
  });
}

// --------------------
// START ROUND (HOST ONLY)
// --------------------
function startRoundOnce() {
  if (startRequested) return;
  startRequested = true;

  console.log("🧪 emitting round:start with roomCode =", roomCode);

  host.emit("round:start", { roomCode }, (res) => {
    console.log("▶️ round:start:", res);
    if (!res?.ok) {
      console.log("❌ round:start failed:", res?.error);
      shutdown(1);
    }
  });
}

// --------------------
// HOST LISTENERS
// --------------------
host.on("room:state", (state) => {
  console.log("📡 Host room:state status =", state.status);
});

host.on("round:state", (payload) => {
  hostRoundRunning = true;
  console.log("🟢 round:state (host) round =", payload?.round?.number);
});

host.on("round:tick", (t) => {
  if (!hostRoundRunning) return;
  const sec = Math.ceil(t.remainingMs / 1000);
  if (sec <= 0) return; // don't spam 0
  console.log("⏱ Host tick:", sec);
});

host.on("round:ended", (e) => {
  hostRoundRunning = false;
  console.log("🏁 Round ended (host)", e || "");
});

host.on("connect_error", (err) => {
  console.log("❌ Host connect error:", err.message);
  shutdown(1);
});

host.on("error", (err) => {
  console.log("❌ Host socket error:", err?.message || err);
});
