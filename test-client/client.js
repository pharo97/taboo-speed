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

// New server logic:
// - cluegiver: round.board = FULL (24 tiles) with word + points
// - guesser: round.board = [] (empty)
function isFullTile(t) {
  return (
    t &&
    typeof t.id === "string" &&
    typeof t.word === "string" &&
    typeof t.points === "number"
  );
}

async function main() {
  let roomCode = null;
  let roomPassword = null;

  let hostToken = null;
  let p2Token = null;
  let p3Token = null;

  let currentActiveTeam = null;
  let currentClueGiverId = null;

  // Keep latest boards (only cluegiver should ever have one)
  let lastFullBoardFromP3 = null;

  // Track reassignment
  let p3BecameClueGiver = false;

  // Track guess:correct events
  let p2SawGuessCorrect = false;
  let p3SawGuessCorrect = false;

  // -------------------------
  // HOST
  // -------------------------
  const host = io(SERVER_URL, { transports: ["websocket"] });

  host.on("connect", () => {
    console.log("✅ Host connected:", host.id);
  });

  host.on("connect_error", (err) => {
    console.log("❌ Host connect error:", err?.message || err);
  });

  host.on("room:sync", (s) => {
    console.log("📡 Host room:sync status =", s.status);
  });

  host.on("round:sync", (payload) => {
    currentClueGiverId = payload?.round?.clueGiverId || null;
    currentActiveTeam = payload?.round?.activeTeam || null;

    const role = payload?.role;
    const board = payload?.round?.board || [];

    console.log(
      "🟢 round:sync (host)",
      "round=",
      payload?.round?.number,
      "activeTeam=",
      currentActiveTeam,
      "clueGiverId=",
      currentClueGiverId,
      "role=",
      role,
      "boardLen=",
      board.length
    );

    // Host might not be cluegiver later; if host is cluegiver => boardLen 24, else 0
    const isClueGiver = host.id && host.id === currentClueGiverId;

    if (isClueGiver) {
      assert(board.length === 24, "Host cluegiver should receive 24 tiles");
      assert(isFullTile(board[0]), "Host cluegiver tiles should include word+points");
      if (role) assert(role === "cluegiver", "Host role should be cluegiver");
    } else {
      assert(board.length === 0, "Host guesser should receive empty board");
      if (role) assert(role === "guesser", "Host role should be guesser");
    }
  });

  host.on("clue:sync", (p) => {
    console.log("🧩 Host saw clue:sync", p);
  });

  host.on("guess:correct", (p) => {
    console.log("✅ Host saw guess:correct", p);
  });

  host.on("round:ended", (p) => {
    console.log("🏁 Round ended (host)", {
      roomCode: p.roomCode,
      roundNumber: p.roundNumber,
      reason: p.reason,
      fullBoardLen: (p.fullBoard || []).length,
      guessedCount: Object.keys(p.guessed || {}).length,
      scores: p.scores,
    });

    assert(Array.isArray(p.fullBoard), "round:ended should include fullBoard array");
    assert(p.fullBoard.length === 24, "round:ended fullBoard should have 24 tiles");
  });

  host.on("game:ended", (p) => {
    console.log("🏆 Game ended (host)", p);
  });

  // -------------------------
  // PLAYER2 (red)
  // -------------------------
  const p2 = io(SERVER_URL, { transports: ["websocket"] });

  p2.on("connect", () => {
    console.log("✅ Player2 connected:", p2.id);
  });

  p2.on("connect_error", (err) => {
    console.log("❌ Player2 connect error:", err?.message || err);
  });

  p2.on("room:sync", (s) => {
    console.log("📡 Player2 room:sync status =", s.status);
  });

  p2.on("round:sync", (payload) => {
    const role = payload?.role;
    const board = payload?.round?.board || [];

    console.log(
      "🟢 round:sync (player2)",
      "round=",
      payload?.round?.number,
      "activeTeam=",
      payload?.round?.activeTeam,
      "clueGiverId=",
      payload?.round?.clueGiverId,
      "role=",
      role,
      "boardLen=",
      board.length
    );

    // Player2 should never be cluegiver in this test setup.
    assert(board.length === 0, "Player2 should always receive empty board");
    if (role) assert(role === "guesser", `Player2 role should be guesser, got ${role}`);
  });

  p2.on("clue:sync", (p) => {
    console.log("🧩 Player2 saw clue:sync", p);
  });

  p2.on("guess:correct", (p) => {
    p2SawGuessCorrect = true;
    console.log("✅ Player2 saw guess:correct", p);
  });

  p2.on("round:ended", (p) => {
    console.log("🏁 Round ended (player2)", {
      reason: p.reason,
      fullBoardLen: (p.fullBoard || []).length,
      scores: p.scores,
    });
  });

  // -------------------------
  // PLAYER3 (blue) - reassignment target
  // -------------------------
  const p3 = io(SERVER_URL, { transports: ["websocket"] });

  p3.on("connect", () => {
    console.log("✅ Player3 connected:", p3.id);
  });

  p3.on("connect_error", (err) => {
    console.log("❌ Player3 connect error:", err?.message || err);
  });

  p3.on("room:sync", (s) => {
    console.log("📡 Player3 room:sync status =", s.status);
  });

  p3.on("round:sync", (payload) => {
    const board = payload?.round?.board || [];
    const isClueGiver = payload?.round?.clueGiverId === p3.id;
    const role = payload?.role;

    console.log(
      "🟢 round:sync (player3)",
      "round=",
      payload?.round?.number,
      "activeTeam=",
      payload?.round?.activeTeam,
      "clueGiverId=",
      payload?.round?.clueGiverId,
      "role=",
      role,
      "boardLen=",
      board.length
    );

    if (isClueGiver) {
      p3BecameClueGiver = true;
      assert(board.length === 24, "Player3 cluegiver should receive 24 tiles");
      assert(isFullTile(board[0]), "Player3 cluegiver tiles should include word+points");
      lastFullBoardFromP3 = board;
      if (role) assert(role === "cluegiver", "Player3 role should be cluegiver");
    } else {
      assert(board.length === 0, "Player3 guesser should receive empty board");
      if (role) assert(role === "guesser", "Player3 role should be guesser");
    }
  });

  p3.on("clue:sync", (p) => {
    console.log("🧩 Player3 saw clue:sync", p);
  });

  p3.on("guess:correct", (p) => {
    p3SawGuessCorrect = true;
    console.log("✅ Player3 saw guess:correct", p);
  });

  p3.on("round:ended", (p) => {
    console.log("🏁 Round ended (player3)", {
      reason: p.reason,
      fullBoardLen: (p.fullBoard || []).length,
      scores: p.scores,
    });
  });

  // -------------------------
  // Wait for connect
  // -------------------------
  while (!host.connected || !p2.connected || !p3.connected) {
    await sleep(50);
  }

  // -------------------------
  // Create room (NO password passed in)
  // IMPORTANT: backend must return roomPassword in callback
  // -------------------------
  const createResp = await new Promise((resolve) => {
    host.emit(
      "room:create",
      { name: "Host", settings: { roundSeconds: 12, targetScore: 9999 } },
      resolve
    );
  });

  console.log("📦 room:create:", createResp);
  assert(createResp.ok, "room:create failed");

  roomCode = createResp.roomCode;
  hostToken = createResp.playerToken;

  roomPassword = createResp.roomPassword;
  assert(
    typeof roomPassword === "string" && roomPassword.length > 0,
    "Missing roomPassword from room:create response (update backend callback)"
  );

  console.log("🔐 Generated room password =", roomPassword);

  // -------------------------
  // Wrong password join should fail (sanity)
  // -------------------------
  const badJoin = await new Promise((resolve) => {
    p2.emit("room:join", { roomCode, name: "Bad", password: "WRONG" }, resolve);
  });
  console.log("🧪 TEST join wrong password:", badJoin);
  assert(badJoin.ok === false, "Join with wrong password should fail");
  assert(badJoin.error === "Wrong password", "Wrong password error mismatch");

  // -------------------------
  // Teams
  // -------------------------
  const hostTeam = await new Promise((resolve) => {
    host.emit("room:team:set", { roomCode, team: "blue" }, resolve);
  });
  console.log("🔵 Host set team:", hostTeam);
  assert(hostTeam.ok, "host team set failed");

  // Join players using GENERATED password
  const join2 = await new Promise((resolve) => {
    p2.emit("room:join", { roomCode, name: "P2", password: roomPassword }, resolve);
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
    p3.emit("room:join", { roomCode, name: "P3", password: roomPassword }, resolve);
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
  assert(startResp.ok === true, "round:start failed");

  // Wait for initial syncs
  await sleep(250);

  // -------------------------
  // Cluegiver disconnect before clue set -> reassign to Player3
  // -------------------------
  console.log("🧪 TEST cluegiver disconnect mid-round (before clue set)");
  host.disconnect();

  // Wait for reassignment to Player3 (blue)
  const t0 = Date.now();
  while (!p3BecameClueGiver && Date.now() - t0 < 2500) {
    await sleep(50);
  }
  assert(p3BecameClueGiver, "Player3 was not reassigned as cluegiver after host disconnect");
  assert(
    Array.isArray(lastFullBoardFromP3) && lastFullBoardFromP3.length === 24,
    "Player3 did not receive full board"
  );

  // -------------------------
  // Only cluegiver can set clue (Player3)
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
  // Wrong-team guess:text
  // Player2 is red, active team should be blue
  // -------------------------
  const wrongTeamGuess = await new Promise((resolve) => {
    p2.emit("guess:text", { roomCode, text: "anything" }, resolve);
  });
  console.log("🧪 TEST wrong-team guess:text (player2):", wrongTeamGuess);
  assert(wrongTeamGuess.ok === false, "Wrong team guess should fail");
  assert(wrongTeamGuess.error === "Not your team's turn", "Wrong team error mismatch");

  // -------------------------
  // Correct guess loop (Player3 is blue + cluegiver)
  // Use full board words
  // -------------------------
  const wordsToGuess = lastFullBoardFromP3.map((t) => t.word);

  for (let i = 0; i < wordsToGuess.length; i++) {
    const guessWord = wordsToGuess[i];
    const r = await new Promise((resolve) => {
      p3.emit("guess:text", { roomCode, text: guessWord }, resolve);
    });

    if (!r.ok) {
      if (r.error === "No active round") break;
      console.log("guess:text failed:", r);
      break;
    }

    await sleep(5);
  }

  // Active-team-only broadcast check:
  assert(p3SawGuessCorrect === true, "Player3 should receive guess:correct events");
  assert(p2SawGuessCorrect === false, "Player2 should NOT receive guess:correct (active team only)");

  // -------------------------
  // Guess after end should fail
  // -------------------------
  const afterEndGuess = await new Promise((resolve) => {
    p3.emit("guess:text", { roomCode, text: wordsToGuess[0] }, resolve);
  });
  console.log("🧪 TEST guess:text after end (player3):", afterEndGuess);
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