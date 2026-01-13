// src/App.jsx
import { useEffect, useRef, useState } from "react";
import { createSocket, SERVER_URL as BACKEND_URL } from "./socket";

import Lobby from "./components/Lobby";
import JoinRoom from "./components/JoinRoom";
import TeamPicker from "./components/TeamPicker";
import PlayerList from "./components/PlayerList";
import HostControls from "./components/HostControls";

import Game from "./game/Game";

export default function App() {
  // Keep socket in state so we can fully reset it on "Leave Game"
  const [socket, setSocket] = useState(() => createSocket());

  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");

  const [roomCode, setRoomCode] = useState(
    localStorage.getItem("roomCode") || ""
  );
  const [playerToken, setPlayerToken] = useState(
    localStorage.getItem("playerToken") || ""
  );

  const [room, setRoom] = useState(null);
  const [round, setRound] = useState(null);
  const [role, setRole] = useState(null); // "cluegiver" | "guesser"

  const [remainingMs, setRemainingMs] = useState(null);
  const [endedInfo, setEndedInfo] = useState(null);

  const [log, setLog] = useState([]);

  // avoids "❌ disconnected" spam when we intentionally hard-leave
  const leavingRef = useRef(false);

  function pushLog(line) {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`${t}  ${line}`, ...prev].slice(0, 200));
  }

  function resetLocalIdentity() {
    localStorage.removeItem("roomCode");
    localStorage.removeItem("playerToken");

    setRoomCode("");
    setPlayerToken("");

    setRoom(null);
    setRound(null);
    setRole(null);
    setRemainingMs(null);
    setEndedInfo(null);
  }

  // Hard-leave: disconnect socket, wipe identity, create fresh socket
  function leaveRoom() {
    pushLog("🚪 leaving room...");
    leavingRef.current = true;

    try {
      socket.disconnect();
    } catch {
      // ignore
    }

    resetLocalIdentity();

    // fresh socket instance so we aren't still joined to old rooms
    const fresh = createSocket();
    setSocket(fresh);

    pushLog("✅ left room (fresh socket)");

    // allow normal disconnect logs again after this tick
    setTimeout(() => {
      leavingRef.current = false;
    }, 0);
  }

  // --- socket wiring
  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setConnected(true);
      setSocketId(socket.id);
      pushLog(`✅ connected: ${socket.id}`);

      // auto rejoin if we have identity
      if (roomCode && playerToken) {
        socket.emit("room:rejoin", { roomCode, playerToken }, (resp) => {
          pushLog(`🔁 room:rejoin ok=${resp?.ok}`);
          if (!resp?.ok) resetLocalIdentity();
        });
      }
    }

    function onDisconnect() {
      setConnected(false);
      setSocketId("");

      if (!leavingRef.current) {
        pushLog("❌ disconnected");
      }
    }

    function onRoomSync(payload) {
      setRoom(payload);
      pushLog(
        `📡 room:sync status=${payload?.status} players=${
          Object.keys(payload?.playersByToken || {}).length
        }`
      );
    }

    function onRoundSync(payload) {
      setRound(payload?.round || null);
      setRole(payload?.role || null);
      pushLog(
        `🟢 round:sync #${payload?.round?.number} team=${payload?.round?.activeTeam} role=${payload?.role}`
      );
    }

    function onClueSync(payload) {
      pushLog(`🧩 clue:sync "${payload?.clue?.text}"`);
    }

    function onTick(payload) {
      setRemainingMs(payload?.remainingMs ?? null);
    }

    function onRoundEnded(payload) {
      setEndedInfo({ type: "round", payload });
      setRemainingMs(null);
      setRound(null);
      setRole(null);
      pushLog(`🏁 round:ended reason=${payload?.reason}`);
    }

    function onGameEnded(payload) {
      setEndedInfo({ type: "game", payload });
      setRemainingMs(null);
      setRound(null);
      setRole(null);
      pushLog(`🏆 game:ended winner=${payload?.winningTeam}`);
    }

    function onGuessCorrect(payload) {
      pushLog(
        `✅ guess:correct "${payload?.word}" +${payload?.points} (${payload?.guessedBy})`
      );
    }

    // legacy server event (ok to keep)
    function onGuessApplied(payload) {
      pushLog(`✅ guess:applied tile=${payload?.tileId} +${payload?.points}`);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:sync", onRoomSync);
    socket.on("round:sync", onRoundSync);
    socket.on("clue:sync", onClueSync);
    socket.on("round:tick", onTick);
    socket.on("round:ended", onRoundEnded);
    socket.on("game:ended", onGameEnded);
    socket.on("guess:correct", onGuessCorrect);
    socket.on("guess:applied", onGuessApplied);

    // cleanup listeners + disconnect this socket instance when it gets replaced
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:sync", onRoomSync);
      socket.off("round:sync", onRoundSync);
      socket.off("clue:sync", onClueSync);
      socket.off("round:tick", onTick);
      socket.off("round:ended", onRoundEnded);
      socket.off("game:ended", onGameEnded);
      socket.off("guess:correct", onGuessCorrect);
      socket.off("guess:applied", onGuessApplied);

      try {
        socket.disconnect();
      } catch {
        // ignore
      }
    };
  }, [socket, roomCode, playerToken]);

  // --- actions
  function createRoom() {
    setEndedInfo(null);

    socket.emit(
      "room:create",
      {
        name: "Host",
        settings: { roundSeconds: 30, targetScore: 300 },
      },
      (resp) => {
        pushLog(`📦 room:create ok=${resp?.ok} code=${resp?.roomCode}`);
        if (!resp?.ok) return;

        localStorage.setItem("roomCode", resp.roomCode);
        localStorage.setItem("playerToken", resp.playerToken);
        setRoomCode(resp.roomCode);
        setPlayerToken(resp.playerToken);
      }
    );
  }

  function joinRoom({ roomCodeInput, name }) {
    setEndedInfo(null);

    socket.emit("room:join", { roomCode: roomCodeInput, name }, (resp) => {
      pushLog(`👤 room:join ok=${resp?.ok}`);
      if (!resp?.ok) return;

      localStorage.setItem("roomCode", resp.roomCode);
      localStorage.setItem("playerToken", resp.playerToken);
      setRoomCode(resp.roomCode);
      setPlayerToken(resp.playerToken);
    });
  }

  function setTeam(team) {
    if (!roomCode) return;
    socket.emit("room:team:set", { roomCode, team }, (resp) => {
      pushLog(`🎯 team:set ${team} ok=${resp?.ok}`);
    });
  }

  function startRound() {
    if (!roomCode) return;
    setEndedInfo(null);
    socket.emit("round:start", { roomCode }, (resp) => {
      pushLog(`▶️ round:start ok=${resp?.ok}`);
    });
  }

  function setClue(text) {
    if (!roomCode) return;
    socket.emit("clue:set", { roomCode, text }, (resp) => {
      pushLog(`🧩 clue:set ok=${resp?.ok}`);
    });
  }

  function submitGuess(text) {
    if (!roomCode) return;
    socket.emit("guess:text", { roomCode, text }, (resp) => {
      if (resp?.ok) return;
      if (resp?.incorrect) pushLog(`❌ guess wrong: "${text}"`);
      else pushLog(`❌ guess error: ${resp?.error || "unknown"}`);
    });
  }

  const players = Object.values(room?.playersByToken || {});
  const me = playerToken ? room?.playersByToken?.[playerToken] : null;
  const isHost = !!me?.isHost;
  const inRoom = !!roomCode && !!playerToken;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      <h2 style={{ marginTop: 0 }}>Taboo Speed</h2>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Backend: {BACKEND_URL} <br />
        Status: {connected ? "CONNECTED" : "DISCONNECTED"} <br />
        Socket ID: {socketId || "-"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Lobby
            inRoom={inRoom}
            isHost={isHost}
            roomCode={roomCode}
            roomStatus={room?.status || "-"}
            onCreateRoom={createRoom}
            onLeaveRoom={leaveRoom}
            joinForm={!inRoom ? <JoinRoom onJoin={joinRoom} /> : null}
          />

          {inRoom && room?.status === "lobby" && (
            <TeamPicker
              myTeam={me?.team || ""}
              onPick={setTeam}
              disabled={false}
            />
          )}

          {inRoom && <PlayerList players={players} myToken={playerToken} />}

          {inRoom && isHost && (
            <HostControls
              onStartRound={startRound}
              disabled={room?.status === "playing"}
            />
          )}

          <Game
            room={room}
            round={round}
            role={role}
            remainingMs={remainingMs}
            endedInfo={endedInfo}
            onSetClue={setClue}
            onGuess={submitGuess}
          />
        </div>

        <div>
          <h3>Live log</h3>
          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              height: 420,
              overflow: "auto",
            }}
          >
            {log.map((l, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
