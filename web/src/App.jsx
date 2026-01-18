// src/App.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { createSocket } from "./socket";

import PageShell from "./components/PageShell";
import ActivityLog from "./components/ActivityLog";
import Button from "./components/Button";
import Lobby from "./components/Lobby";
import JoinRoom from "./components/JoinRoom";
import TeamPicker from "./components/TeamPicker";
import PlayerList from "./components/PlayerList";
import HostControls from "./components/HostControls";
import Toast from "./components/Toast";
import ReconnectingOverlay from "./components/ReconnectingOverlay";
import ResponsiveContainer from "./components/ResponsiveContainer";

import Game from "./game/Game";

export default function App() {
  const [socket, setSocket] = useState(() => createSocket());

  const [connected, setConnected] = useState(false);

  const [roomCode, setRoomCode] = useState(
    localStorage.getItem("roomCode") || "",
  );
  const [playerToken, setPlayerToken] = useState(
    localStorage.getItem("playerToken") || "",
  );

  const [room, setRoom] = useState(null);
  const [round, setRound] = useState(null);
  const [role, setRole] = useState(null);

  const [remainingMs, setRemainingMs] = useState(null);
  const [endedInfo, setEndedInfo] = useState(null);
  const [guessLog, setGuessLog] = useState([]);

  const [log, setLog] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [previousPlayerStates, setPreviousPlayerStates] = useState({});

  const leavingRef = useRef(false);
  const leaveRoomRef = useRef(null);
  const activeTeamRef = useRef(null);

  const pushLog = useCallback((line) => {
    const t = new Date().toLocaleTimeString();
    setLog((prev) => [`${t}  ${line}`, ...prev].slice(0, 200));
  }, []);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, ...toast }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
    setGuessLog([]);
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
            if (resp?.ok) {
              setIsReconnecting(false);
              addToast({
                type: "success",
                message: "Reconnected successfully!",
              });
            } else {
              resetLocalIdentity();
              setIsReconnecting(false);
            }
          },
        );
      } else {
        setIsReconnecting(false);
      }
    }

    function onDisconnect(reason) {
      setConnected(false);
      if (!leavingRef.current) {
        pushLog(`❌ disconnected (${reason || "no reason"})`);

        // Show reconnecting overlay if we're in a room
        const rc = localStorage.getItem("roomCode");
        if (rc) {
          setIsReconnecting(true);
          addToast({
            type: "warning",
            message: "Connection lost. Attempting to reconnect...",
          });
        }
      }
    }

    function onConnectError(err) {
      pushLog(`🔥 connect_error: ${err?.message || String(err)}`);
    }

    function onRoomSync(payload) {
      setRoom(payload);
      activeTeamRef.current = payload?.round?.activeTeam || null;

      // Check for player connection changes
      const currentPlayers = payload?.playersByToken || {};
      Object.entries(currentPlayers).forEach(([token, player]) => {
        const wasConnected = previousPlayerStates[token]?.connected;
        const isNowConnected = player.connected;

        // Skip notification for self
        if (token === playerToken) return;

        // Player disconnected
        if (wasConnected && !isNowConnected) {
          addToast({
            type: "info",
            message: `${player.name} disconnected`,
          });
        }

        // Player reconnected
        if (!wasConnected && isNowConnected && previousPlayerStates[token]) {
          addToast({
            type: "success",
            message: `${player.name} reconnected`,
          });
        }
      });

      // Update previous states
      setPreviousPlayerStates(
        Object.entries(currentPlayers).reduce((acc, [token, player]) => {
          acc[token] = { connected: player.connected };
          return acc;
        }, {}),
      );

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
        } offer=${offerStatus} team=${offerTeam} offered=${offered} accepted=${accepted}`,
      );
    }

    function onRoundSync(payload) {
      setRound(payload?.round || null);
      setRole(payload?.role || null);

      // Clear guess log when a new round starts
      if (payload?.round?.number) {
        setGuessLog([]);
      }

      pushLog(
        `🟢 round:sync #${payload?.round?.number} team=${payload?.round?.activeTeam} role=${payload?.role}`,
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
        `✅ guess:correct "${payload?.word}" +${payload?.points} (${payload?.guessedBy})`,
      );

      // Add to guess log (we need to get team from room state)
      setGuessLog((prev) => [
        ...prev,
        {
          word: payload.word,
          points: payload.points,
          guessedBy: payload.guessedBy,
          team: activeTeamRef.current || "unknown",
          timestamp: Date.now(),
        },
      ]);
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
        } token=${payload?.offeredToken?.slice?.(0, 6)}...`,
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
  }, [
    socket,
    pushLog,
    resetLocalIdentity,
    addToast,
    playerToken,
    previousPlayerStates,
  ]);

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
      },
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
      },
    );
  }

  function updateSettings(settings) {
    if (!roomCode) return;
    socket.emit("room:settings:set", { roomCode, settings }, (resp) => {
      pushLog(`⚙️ settings:set ok=${resp?.ok}`);
      if (!resp?.ok) pushLog(`❌ settings error: ${resp?.error || "unknown"}`);
    });
  }

  function endGame() {
    if (!roomCode) return;
    const confirmed = window.confirm(
      "Are you sure you want to end the game? Winner will be determined by current score.",
    );
    if (!confirmed) return;

    socket.emit("game:end", { roomCode }, (resp) => {
      pushLog(`🏁 game:end ok=${resp?.ok} winner=${resp?.winningTeam}`);
      if (!resp?.ok) pushLog(`❌ end game error: ${resp?.error || "unknown"}`);
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

  // Start the round after accepting cluegiver role
  function startAcceptedRound() {
    if (!roomCode) return;

    pushLog(`Starting round as cluegiver`);

    socket.emit("round:startAccepted", { roomCode }, (resp) => {
      if (!resp?.ok) {
        pushLog(`❌ Start round error: ${resp?.error || "unknown"}`);
      } else {
        pushLog(`✅ Round started successfully`);
      }
    });
  }

  const players = Object.values(room?.playersByToken || {});
  const me = playerToken ? room?.playersByToken?.[playerToken] : null;
  const myTeam = me?.team || null;

  // Determine theme based on player's team
  const currentTheme =
    myTeam === "blue" ? "blue" : myTeam === "red" ? "red" : "neutral";

  // Helper to display room status in a user-friendly way
  const getStatusDisplay = (status) => {
    const statusMap = {
      lobby: { text: "Lobby", color: "#6c757d" },
      offer: { text: "Selecting Cluegiver", color: "#0dcaf0" },
      accepted: { text: "Ready to Start", color: "#198754" },
      running: { text: "Playing", color: "#0d6efd" },
      round_end: { text: "Round Ended", color: "#ffc107" },
      ended: { text: "Game Over", color: "#dc3545" },
    };
    return statusMap[status] || { text: status, color: "#6c757d" };
  };

  const statusDisplay = getStatusDisplay(room?.status);

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

  // Use centered layout for home page (not in room)
  const isCentered = !inRoom;

  return (
    <PageShell theme={currentTheme} centered={isCentered}>
      {/* Header */}
      <div style={isCentered ? centeredHeader : appHeader}>
        <div style={logoContainer}>
          <h1 style={isCentered ? centeredLogoText : logoText}>
            {isCentered ? (
              <>
                <div style={mainTitle}>Candhuuf's Taboo</div>
                <div style={subtitle}>For the Clubhouse fiends</div>
              </>
            ) : (
              <span style={inGameTitle}>Candhuuf's Taboo</span>
            )}
          </h1>
          {inRoom && (
            <span style={statusBadge(statusDisplay.color)}>
              {statusDisplay.text}
            </span>
          )}
        </div>
      </div>

      {/* Offer banner (pending + accepted) */}
      {inRoom && room?.status === "lobby" && currentOffer && (
        <div
          style={{
            border: "1px solid #444",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            background: "#1a1a1a",
            color: "#fff",
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

      {/* Home page - centered lobby only */}
      {!inRoom && (
        <Lobby
          inRoom={inRoom}
          isHost={isHost}
          roomCode={roomCode}
          roomStatus={room?.status || "-"}
          onCreateRoom={createRoom}
          onLeaveRoom={leaveRoom}
          joinForm={<JoinRoom onJoin={joinRoom} />}
        />
      )}

      {/* Game interface - only show when in room */}
      {inRoom && (
        <ResponsiveContainer>
          <div>
            <Lobby
              inRoom={inRoom}
              isHost={isHost}
              roomCode={roomCode}
              roomStatus={room?.status || "-"}
              onCreateRoom={createRoom}
              onLeaveRoom={leaveRoom}
              joinForm={null}
            />

            {room?.status === "lobby" && (
              <TeamPicker
                myTeam={me?.team || ""}
                onPick={setTeam}
                disabled={false}
              />
            )}

            <PlayerList
              players={players}
              myToken={playerToken}
              isHost={isHost}
              onKick={kickPlayer}
              onMakeHost={transferHost}
            />

            {isHost && (
              <HostControls
                room={room}
                offer={room?.round?.offer || null}
                onStartRound={startRound}
                onUpdateSettings={updateSettings}
                onEndGame={endGame}
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
              guessLog={guessLog}
            />
          </div>

          <ActivityLog log={log} maxEntries={50} />
        </ResponsiveContainer>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Reconnecting Overlay */}
      <ReconnectingOverlay show={isReconnecting && !connected} />
    </PageShell>
  );
}

// Styles
const appHeader = {
  marginBottom: "var(--space-xl)",
};

const logoContainer = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-md)",
  flexWrap: "wrap",
  marginBottom: "var(--space-sm)",
};

const logoText = {
  margin: 0,
  fontSize: "var(--text-3xl)",
  fontWeight: 800,
  color: "var(--text-primary)",
  letterSpacing: "0.02em",
};

const statusBadge = (color) => ({
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: "var(--radius-full)",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  backgroundColor: color || "var(--bg-tertiary)",
  color: "white",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
});

// Centered landing page styles
const centeredHeader = {
  textAlign: "center",
  marginBottom: "var(--space-2xl)",
};

const centeredLogoText = {
  margin: 0,
  fontSize: "clamp(32px, 6vw, 56px)",
  fontWeight: 800,
  color: "var(--text-primary)",
  letterSpacing: "0.02em",
  lineHeight: 1.2,
};

const mainTitle = {
  background: "linear-gradient(135deg, var(--red-light), var(--blue-light))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  marginBottom: "var(--space-sm)",
};

const subtitle = {
  fontSize: "clamp(16px, 3vw, 24px)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  fontStyle: "italic",
};

const inGameTitle = {
  background: "linear-gradient(135deg, var(--red-light), var(--blue-light))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};
