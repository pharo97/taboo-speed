// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { createSocket, SERVER_URL as BACKEND_URL } from "./socket";

import Lobby from "./components/Lobby";
import JoinRoom from "./components/JoinRoom";
import TeamPicker from "./components/TeamPicker";
import PlayerList from "./components/PlayerList";
import HostControls from "./components/HostControls";

import Game from "./game/Game";

export default function App() {
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
  const [role, setRole] = useState(null);

  const [remainingMs, setRemainingMs] = useState(null);
  const [endedInfo, setEndedInfo] = useState(null);

  const [log, setLog] = useState([]);

  const leavingRef = useRef(false);
  const leaveRoomRef = useRef(null);

  const pushLog = useCallback((line) => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`${t}  ${line}`, ...prev].slice(0, 200));
  }, []);

  const resetLocalIdentity = useCallback(() => {
    localStorage.removeItem("roomCode");
    localStorage.removeItem("playerToken");

    setRoomCode("");
    setPlayerToken("");

    setRoom(null);
    setRound(null);
    setRole(null);
    setRemainingMs(null);
    setEndedInfo(null);
  }, []);

  const leaveRoom = useCallback(() => {
    pushLog("🚪 leaving room...");
    leavingRef.current = true;

    const safe = (fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    };

    safe(() => {
      const rc = localStorage.getItem("roomCode") || roomCode;
      if (rc) socket.emit("room:leave", { roomCode: rc }, () => {});
    });

    safe(() => socket.disconnect());

    resetLocalIdentity();

    const fresh = createSocket();
    setSocket(fresh);

    pushLog("✅ left room (fresh socket)");

    setTimeout(() => {
      leavingRef.current = false;
    }, 0);
  }, [pushLog, resetLocalIdentity, roomCode, socket]);

  useEffect(() => {
    leaveRoomRef.current = leaveRoom;
  }, [leaveRoom]);

  // --- socket wiring
  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setConnected(true);
      setSocketId(socket.id);
      pushLog(`✅ connected: ${socket.id}`);

      const rc = localStorage.getItem("roomCode") || "";
      const pt = localStorage.getItem("playerToken") || "";

      if (rc && pt) {
        setRoomCode((prev) => (prev !== rc ? rc : prev));
        setPlayerToken((prev) => (prev !== pt ? pt : prev));

        socket.emit(
          "room:rejoin",
          { roomCode: rc, playerToken: pt },
          (resp) => {
            pushLog(`🔁 room:rejoin ok=${resp?.ok}`);
            if (!resp?.ok) resetLocalIdentity();
          }
        );
      }
    }

    function onDisconnect(reason) {
      setConnected(false);
      setSocketId("");
      if (!leavingRef.current) {
        pushLog(`❌ disconnected (${reason || "no reason"})`);
      }
    }

    function onConnectError(err) {
      pushLog(`🔥 connect_error: ${err?.message || String(err)}`);
    }

    function onRoomSync(payload) {
      setRoom(payload);

      const offer = payload?.round?.offer || null;
      const offerStatus = offer?.status || "none";
      const offerTeam = offer?.team || "-";
      const offered = offer?.offeredToken
        ? offer.offeredToken.slice(0, 6)
        : "-";
      const accepted = offer?.acceptedToken
        ? offer.acceptedToken.slice(0, 6)
        : "-";

      pushLog(
        `📡 room:sync status=${payload?.status} players=${
          Object.keys(payload?.playersByToken || {}).length
        } offer=${offerStatus} team=${offerTeam} offered=${offered} accepted=${accepted}`
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

    function onGuessApplied(payload) {
      pushLog(`✅ guess:applied tile=${payload?.tileId} +${payload?.points}`);
    }

    function onKicked(payload) {
      pushLog(`🥾 kicked: ${payload?.reason || "no reason provided"}`);
      leaveRoomRef.current?.();
    }

    function onOffer(payload) {
      pushLog(
        `📨 cluegiver:offer team=${
          payload?.team
        } token=${payload?.offeredToken?.slice?.(0, 6)}...`
      );
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.on("room:sync", onRoomSync);
    socket.on("round:sync", onRoundSync);
    socket.on("clue:sync", onClueSync);
    socket.on("round:tick", onTick);
    socket.on("round:ended", onRoundEnded);
    socket.on("game:ended", onGameEnded);
    socket.on("guess:correct", onGuessCorrect);
    socket.on("guess:applied", onGuessApplied);

    socket.on("room:kicked", onKicked);
    socket.on("cluegiver:offer", onOffer);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      socket.off("room:sync", onRoomSync);
      socket.off("round:sync", onRoundSync);
      socket.off("clue:sync", onClueSync);
      socket.off("round:tick", onTick);
      socket.off("round:ended", onRoundEnded);
      socket.off("game:ended", onGameEnded);
      socket.off("guess:correct", onGuessCorrect);
      socket.off("guess:applied", onGuessApplied);

      socket.off("room:kicked", onKicked);
      socket.off("cluegiver:offer", onOffer);
    };
  }, [socket, pushLog, resetLocalIdentity]);

  // --- actions
  function createRoom(hostName) {
    setEndedInfo(null);

    const cleanName = String(hostName || "Host")
      .trim()
      .slice(0, 40);

    socket.emit(
      "room:create",
      { name: cleanName, settings: { roundSeconds: 30, targetScore: 300 } },
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
      if (!resp?.ok) pushLog(`❌ team error: ${resp?.error || "unknown"}`);
    });
  }

  function startRound() {
    if (!roomCode) return;
    setEndedInfo(null);

    socket.emit("round:start", { roomCode }, (resp) => {
      if (resp?.ok && resp?.pendingOffer) {
        pushLog(`📨 offer pending (waiting for accept)`);
        return;
      }

      pushLog(`▶️ round:start ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ start error: ${resp?.error || "unknown"}`);
    });
  }

  function setClue(text) {
    if (!roomCode) return;
    socket.emit("clue:set", { roomCode, text }, (resp) => {
      pushLog(`🧩 clue:set ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ clue error: ${resp?.error || "unknown"}`);
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

  function kickPlayer(tokenToKick) {
    if (!roomCode) return;

    socket.emit("room:kick", { roomCode, playerToken: tokenToKick }, (resp) => {
      pushLog(`🦵 kick ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ kick error: ${resp?.error || "unknown"}`);
    });
  }

  function transferHost(tokenToPromote) {
    if (!roomCode) return;

    socket.emit(
      "room:host:transfer",
      { roomCode, playerToken: tokenToPromote },
      (resp) => {
        pushLog(`👑 host transfer ok=${resp?.ok}`);
        if (!resp?.ok)
          pushLog(`❌ transfer error: ${resp?.error || "unknown"}`);
      }
    );
  }

  function updateSettings(settings) {
    if (!roomCode) return;
    socket.emit("room:settings:set", { roomCode, settings }, (resp) => {
      pushLog(`⚙️ settings:set ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ settings error: ${resp?.error || "unknown"}`);
    });
  }

  function acceptOffer() {
    if (!roomCode) return;
    socket.emit("cluegiver:accept", { roomCode }, (resp) => {
      pushLog(`✅ offer accept ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ accept error: ${resp?.error || "unknown"}`);
    });
  }

  function skipOffer() {
    if (!roomCode) return;
    socket.emit("cluegiver:decline", { roomCode }, (resp) => {
      pushLog(`⏭ cluegiver:decline ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ decline error: ${resp?.error || "unknown"}`);
    });
  }

  // ---- THE FIX: start accepted round with aggressive logging + event-name fallback
  function startAcceptedRound() {
    if (!roomCode) return;

    // if you click and don't see this, your click isn't reaching React at all
    pushLog(`🧷 startAcceptedRound() CLICKED roomCode=${roomCode}`);
    pushLog(`🧪 socket.id=${socket?.id} connected=${socket?.connected}`);

    const candidates = [
      "round:startAccepted", // one naming style
      "round:start:accepted", // another naming style
      "round:start:acceptedRound", // just in case (people name things badly)
      "round:start:accepted", // yes, duplicate-ish, still fine for testing
    ];

    let acked = false;

    // try each name until one acks
    candidates.forEach((eventName, idx) => {
      setTimeout(() => {
        if (acked) return;

        pushLog(`📤 emitting "${eventName}"...`);

        let callbackCalled = false;

        socket.emit(eventName, { roomCode }, (resp) => {
          callbackCalled = true;
          acked = true;
          pushLog(`🟣 ACK from "${eventName}" ok=${resp?.ok}`);
          if (!resp?.ok) {
            pushLog(`❌ accepted-start error: ${resp?.error || "unknown"}`);
          }
        });

        // if backend doesn't have that event, callback never fires
        setTimeout(() => {
          if (acked) return;
          if (!callbackCalled) {
            pushLog(`🕳 no ACK for "${eventName}" (likely wrong event name)`);
          }
        }, 700);
      }, idx * 200); // stagger the attempts
    });
  }

  const players = Object.values(room?.playersByToken || {});
  const me = playerToken ? room?.playersByToken?.[playerToken] : null;
  const myTeam = me?.team || null;

  const isHost = !!me?.isHost;
  const inRoom = !!roomCode && !!playerToken;

  const currentOffer = room?.round?.offer || null;

  const iAmOffered =
    !!currentOffer &&
    currentOffer.status === "pending" &&
    currentOffer.offeredToken === playerToken;

  const iAcceptedOffer =
    !!currentOffer &&
    currentOffer.status === "accepted" &&
    currentOffer.acceptedToken === playerToken;

  const acceptedName =
    currentOffer?.status === "accepted" && currentOffer?.acceptedToken
      ? room?.playersByToken?.[currentOffer.acceptedToken]?.name || "Someone"
      : "Someone";

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      <h2 style={{ marginTop: 0 }}>Taboo Speed</h2>

      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Backend: {BACKEND_URL} <br />
        Status: {connected ? "CONNECTED" : "DISCONNECTED"} <br />
        Socket ID: {socketId || "-"}
      </div>

      {/* Offer banner (pending + accepted) */}
      {inRoom && room?.status === "lobby" && currentOffer && (
        <div
          style={{
            border: "2px solid #333",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            background: "#fafafa",
          }}
        >
          {currentOffer.status === "pending" ? (
            iAmOffered ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  You’ve been selected as Cluegiver ({currentOffer.team})
                </div>
                <div style={{ opacity: 0.8, marginBottom: 10 }}>
                  Accept to take the role. Skip to pass to the next player.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={acceptOffer}>Accept</button>
                  <button onClick={skipOffer}>Skip</button>
                </div>
              </>
            ) : (
              <div style={{ fontWeight: 600 }}>
                Waiting for offered cluegiver to accept or skip…
              </div>
            )
          ) : currentOffer.status === "accepted" ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Accepted cluegiver: {acceptedName} ({currentOffer.team})
              </div>

              {iAcceptedOffer ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onPointerDown={() =>
                      pushLog("🧷 banner StartRound pointerDown")
                    }
                    onClickCapture={() =>
                      pushLog("🎯 banner StartRound clickCapture")
                    }
                    onClick={() => {
                      pushLog("✅ banner StartRound onClick");
                      startAcceptedRound();
                    }}
                  >
                    Start Round
                  </button>
                  <button onClick={skipOffer}>Pass / Decline</button>
                </div>
              ) : (
                <div style={{ opacity: 0.85 }}>
                  Waiting for accepted cluegiver to start…
                </div>
              )}
            </>
          ) : (
            <div style={{ opacity: 0.8 }}>Offer in progress…</div>
          )}
        </div>
      )}

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

          {inRoom && (
            <PlayerList
              players={players}
              myToken={playerToken}
              isHost={isHost}
              onKick={kickPlayer}
              onMakeHost={transferHost}
            />
          )}

          {inRoom && isHost && (
            <HostControls
              room={room}
              offer={room?.round?.offer || null}
              onStartRound={startRound}
              onUpdateSettings={updateSettings}
              currentSettings={room?.settings}
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
            myTeam={myTeam}
            myToken={playerToken}
            offer={room?.round?.offer || null}
            onAcceptOffer={acceptOffer}
            onSkipOffer={skipOffer}
            onStartAcceptedRound={startAcceptedRound}
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
