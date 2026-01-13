/* test-client/client.js */
const { io } = require("socket.io-client");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ ASSERT FAILED:", msg);
    process.exit(1);
  }
}

function hasPointsInBoard(payload) {
  const board = payload?.round?.board || [];
  if (!board.length) return false;
  return Object.prototype.hasOwnProperty.call(board[0], "points");
}

async function main() {
  let roomCode = null;
  let hostToken = null;
  let p2Token = null;
  let p3Token = null;

  let hostSocketId = null;
  let p2SocketId = null;
  let p3SocketId = null;

  let currentClueGiverId = null;
  let currentActiveTeam = null;

  // -------------------------
  // HOST
  // -------------------------
  const host = io(SERVER_URL, { transports: ["websocket"] });

  host.on("connect", () => {
    hostSocketId = host.id;
    console.log("✅ Host connected:", host.id);
  });

  host.on("room:sync", (s) => {
    console.log("📡 Host room:sync status =", s.status);
  });

  host.on("round:sync", (payload) => {
    const hp = hasPointsInBoard(payload);
    currentClueGiverId = payload?.round?.clueGiverId || null;
    currentActiveTeam = payload?.round?.activeTeam || null;

    console.log(
      "🟢 round:sync (host) round =",
      payload?.round?.number,
      "activeTeam =",
      currentActiveTeam,
      "clueGiverId =",
      currentClueGiverId,
      "clueGiverToken =",
      payload?.round?.clueGiverToken,
      "hasPoints=",
      hp
    );

    // Masking assertion: host SHOULD have points only if host is cluegiver
    const isClueGiver = host.id && currentClueGiverId === host.id;
    assert(
      isClueGiver ? hp === true : hp === false,
      `Host board masking wrong. isClueGiver=${isClueGiver} hasPoints=${hp}`
    );
  });

  host.on("clue:sync", (p) => {
    console.log("🧩 Host saw clue:sync", p);
  });

  host.on("guess:applied", (p) => {
    console.log("✅ Host saw guess:applied", p);
  });

  host.on("round:ended", (p) => {
    console.log("🏁 Round ended (host)", p);
  });

  host.on("game:ended", (p) => {
    console.log("🏆 Game ended (host)", p);
  });

  // -------------------------
  // PLAYER2 (red)
  // -------------------------
  const p2 = io(SERVER_URL, { transports: ["websocket"] });

  p2.on("connect", () => {
    p2SocketId = p2.id;
    console.log("✅ Player2 connected:", p2.id);
  });

  p2.on("room:sync", (s) => {
    console.log("📡 Player2 room:sync status =", s.status);
  });

  p2.on("round:sync", (payload) => {
    const hp = hasPointsInBoard(payload);
    console.log(
      "🟢 round:sync (player2) round =",
      payload?.round?.number,
      "activeTeam =",
      payload?.round?.activeTeam,
      "clueGiverId =",
      payload?.round?.clueGiverId,
      "clueGiverToken =",
      payload?.round?.clueGiverToken,
      "hasPoints=",
      hp
    );

    // Non-cluegiver must NEVER have points
    assert(hp === false, "Player2 should never receive points in masked board");
  });

  p2.on("clue:sync", (p) => {
    console.log("🧩 Player2 saw clue:sync", p);
  });

  p2.on("guess:applied", (p) => {
    console.log("✅ Player2 saw guess:applied", p);
  });

  p2.on("round:ended", (p) => {
    console.log("🏁 Round ended (player2)", p);
  });

  // -------------------------
  // PLAYER3 (blue) - used for cluegiver reassignment test
  // -------------------------
  const p3 = io(SERVER_URL, { transports: ["websocket"] });

  p3.on("connect", () => {
    p3SocketId = p3.id;
    console.log("✅ Player3 connected:", p3.id);
  });

  p3.on("room:sync", (s) => {
    console.log("📡 Player3 room:sync status =", s.status);
  });

  let p3BecameClueGiver = false;

  p3.on("round:sync", (payload) => {
    const hp = hasPointsInBoard(payload);
    const isClueGiver = payload?.round?.clueGiverId === p3.id;

    console.log(
      "🟢 round:sync (player3) round =",
      payload?.round?.number,
      "activeTeam =",
      payload?.round?.activeTeam,
      "clueGiverId =",
      payload?.round?.clueGiverId,
      "clueGiverToken =",
      payload?.round?.clueGiverToken,
      "hasPoints=",
      hp
    );

    // Player3 should have points ONLY if they are cluegiver
    assert(
      isClueGiver ? hp === true : hp === false,
      `Player3 masking wrong. isClueGiver=${isClueGiver} hasPoints=${hp}`
    );

    if (isClueGiver) p3BecameClueGiver = true;
  });

  p3.on("clue:sync", (p) => {
    console.log("🧩 Player3 saw clue:sync", p);
  });

  p3.on("guess:applied", (p) => {
    console.log("✅ Player3 saw guess:applied", p);
  });

  p3.on("round:ended", (p) => {
    console.log("🏁 Round ended (player3)", p);
  });

  // -------------------------
  // Wait for connect
  // -------------------------
  while (!host.connected || !p2.connected || !p3.connected) {
    await sleep(50);
  }

  // -------------------------
  // Create room
  // -------------------------
  const createResp = await new Promise((resolve) => {
    host.emit(
      "room:create",
      { name: "Host", password: "pw", settings: { roundSeconds: 12, targetScore: 9999 } },
      resolve
    );
  });
  console.log("📦 room:create:", createResp);
  assert(createResp.ok, "room:create failed");
  roomCode = createResp.roomCode;
  hostToken = createResp.playerToken;

  // Set teams
  const hostTeam = await new Promise((resolve) => {
    host.emit("room:team:set", { roomCode, team: "blue" }, resolve);
  });
  console.log("🔵 Host set team:", hostTeam);
  assert(hostTeam.ok, "host team set failed");

  const join2 = await new Promise((resolve) => {
    p2.emit("room:join", { roomCode, name: "P2", password: "pw" }, resolve);
  });
  console.log("👤 Player2 join:", join2);
  assert(join2.ok, "player2 join failed");
  p2Token = join2.playerToken;

  const p2Team = await new Promise((resolve) => {
    p2.emit("room:team:set", { roomCode, team: "red" }, resolve);
  });
  console.log("🔴 Player2 set team:", p2Team);
  assert(p2Team.ok, "player2 team set failed");

  const join3 = await new Promise((resolve) => {
    p3.emit("room:join", { roomCode, name: "P3", password: "pw" }, resolve);
  });
  console.log("👤 Player3 join:", join3);
  assert(join3.ok, "player3 join failed");
  p3Token = join3.playerToken;

  const p3Team = await new Promise((resolve) => {
    p3.emit("room:team:set", { roomCode, team: "blue" }, resolve);
  });
  console.log("🔵 Player3 set team:", p3Team);
  assert(p3Team.ok, "player3 team set failed");

  // -------------------------
  // Non-host cannot start
  // -------------------------
  const nonHostStart = await new Promise((resolve) => {
    p2.emit("round:start", { roomCode }, resolve);
  });
  console.log("🧪 TEST non-host round:start:", nonHostStart);
  assert(nonHostStart.ok === false, "Non-host should not be able to start");

  // -------------------------
  // Start round (host)
  // -------------------------
  console.log("🧪 emitting round:start with roomCode =", roomCode);
  const startResp = await new Promise((resolve) => {
    host.emit("round:start", { roomCode }, resolve);
  });
  console.log("▶️ round:start:", startResp);
  assert(startResp.ok, "round:start failed");

  // Give sync a moment
  await sleep(250);

  // -------------------------
  // NEW TEST: cluegiver disconnect mid-round BEFORE clue is set
  // Expected: server reassigns cluegiver to connected blue (Player3)
  // -------------------------
  console.log("🧪 TEST cluegiver disconnect mid-round (before clue set)");
  host.disconnect(); // hard drop

  // Wait for reassignment
  const t0 = Date.now();
  while (!p3BecameClueGiver && Date.now() - t0 < 2000) {
    await sleep(50);
  }
  assert(p3BecameClueGiver, "Player3 was not reassigned as cluegiver after host disconnect");

  // -------------------------
  // Only cluegiver can set clue (now Player3)
  // -------------------------
  const badClueByP2 = await new Promise((resolve) => {
    p2.emit("clue:set", { roomCode, text: "horse" }, resolve);
  });
  console.log("🧪 TEST bad clue:set by player2:", badClueByP2);
  assert(badClueByP2.ok === false, "Player2 should not set clue");

  const goodClueByP3 = await new Promise((resolve) => {
    p3.emit("clue:set", { roomCode, text: "horse" }, resolve);
  });
  console.log("🧩 clue:set by reassigned cluegiver (player3):", goodClueByP3);
  assert(goodClueByP3.ok === true, "Player3 should set clue");

  // -------------------------
  // Wrong-team guess: player2 is red, activeTeam is blue
  // -------------------------
  const wrongTeamGuess = await new Promise((resolve) => {
    p2.emit("guess:submit", { roomCode, tileId: "nope" }, resolve);
  });
  console.log("🧪 TEST wrong-team guess:", wrongTeamGuess);
  assert(wrongTeamGuess.ok === false, "Wrong team guess should fail");

  // -------------------------
  // Guess loop: player3 (blue) guesses tiles until board ends
  // We need real tile ids; pull from last round:sync on player3 by waiting briefly
  // -------------------------
  await sleep(200);

  // We'll ask server for round sync by rejoin (cheap) OR rely on stored startResp board (masked)
  // startResp.round.board is FULL only for cluegiver at the time. Host was cluegiver then.
  // So instead, we listen to latest payload stored locally by doing a tiny hack:
  // We'll request a fresh round sync by doing room:rejoin (player3) to receive authoritative round:sync.
  const rejoin3 = await new Promise((resolve) => {
    p3.emit("room:rejoin", { roomCode, playerToken: p3Token, name: "P3" }, resolve);
  });
  assert(rejoin3.ok, "player3 rejoin failed");

  // Capture tiles from one-time round:sync event
  let tiles = null;
  const tilePromise = new Promise((resolve) => {
    const handler = (payload) => {
      tiles = payload?.round?.board || [];
      p3.off("round:sync", handler);
      resolve();
    };
    p3.on("round:sync", handler);
  });
  await tilePromise;

  assert(Array.isArray(tiles) && tiles.length === 24, "Did not receive 24 tiles on round sync");

  // Guess each tile once
  for (const t of tiles) {
    const r = await new Promise((resolve) => {
      p3.emit("guess:submit", { roomCode, tileId: t.id }, resolve);
    });
    if (!r.ok) {
      // once the round ends, server will say "No active round"
      if (r.error === "No active round") break;
      console.log("guess fail:", r);
      break;
    }
    await sleep(10);
  }

  // Post-round guess should fail
  const afterEndGuess = await new Promise((resolve) => {
    p3.emit("guess:submit", { roomCode, tileId: tiles[0].id }, resolve);
  });
  console.log("🧪 TEST guess after end (player3):", afterEndGuess);
  assert(afterEndGuess.ok === false, "Guess after end should fail");

  // Cleanup
  p2.disconnect();
  p3.disconnect();

  console.log("✅ ALL NEW TESTS PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});