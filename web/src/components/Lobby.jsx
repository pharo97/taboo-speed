// web/src/components/Lobby.jsx
import { useState } from "react";
import { HomeIcon, LogOutIcon } from "./Icons";
import Button from "./Button";

export default function Lobby({
  inRoom,
  isHost,
  roomCode,
  roomStatus,
  onCreateRoom,
  onLeaveRoom,
  joinForm,
}) {
  const [showJoin, setShowJoin] = useState(false);
  const [hostName, setHostName] = useState("");

  function handleCreate(e) {
    e?.preventDefault?.();

    const nm = String(hostName || "")
      .trim()
      .slice(0, 40);
    if (!nm) return;

    onCreateRoom?.(nm);
  }

  // HOME
  if (!inRoom) {
    return (
      <div style={homeCard}>
        <div style={header}>
          <HomeIcon size={18} color="var(--text-primary)" />
          <h4 style={title}>Game Lobby</h4>
        </div>

        <form onSubmit={handleCreate} style={form}>
          <input
            placeholder="Enter your nickname..."
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            style={input}
            maxLength={40}
            autoComplete="off"
          />

          <div style={buttonGroup}>
            <Button
              variant="primary"
              type="submit"
              disabled={!hostName.trim()}
              size="large"
            >
              Create Game
            </Button>

            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowJoin((v) => !v)}
              size="large"
            >
              {showJoin ? "Close Join" : "Join Game"}
            </Button>
          </div>

          <div style={hint}>
            Pick a nickname to start playing with friends
          </div>
        </form>

        {showJoin && (
          <div id="join-panel" style={joinPanel}>
            {joinForm ? (
              joinForm
            ) : (
              <div style={emptyJoin}>
                Join form not available
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // IN ROOM
  return (
    <div style={card}>
      <div style={header}>
        <HomeIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Room Info</h4>
      </div>

      <div style={roomInfo}>
        <div style={roomCodeRow}>
          <span style={label}>Room Code:</span>
          <span style={mono}>{roomCode || "-"}</span>
        </div>
        <div style={roomCodeRow}>
          <span style={label}>Status:</span>
          <span>{roomStatus || "-"}</span>
        </div>
        {isHost && (
          <div style={hostBadge}>
            You are the host
          </div>
        )}
        <div style={hint}>
          Share code <strong style={mono}>{roomCode}</strong> with friends to join
        </div>
      </div>

      <div style={buttonGroup}>
        <Button
          variant="danger"
          onClick={() => {
            setShowJoin(false);
            onLeaveRoom?.();
          }}
        >
          <LogOutIcon size={16} color="#fff" />
          Leave Game
        </Button>
      </div>
    </div>
  );
}

const card = {
  border: "1px solid var(--border-primary)",
  padding: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  marginBottom: "var(--space-md)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
};

const header = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-sm)",
  marginBottom: "var(--space-md)",
};

const title = {
  margin: 0,
  fontSize: "var(--text-lg)",
  color: "var(--text-primary)",
  fontWeight: 600,
};

const form = {
  display: "grid",
  gap: "var(--space-md)",
};

const input = {
  padding: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-secondary)",
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: "var(--text-base)",
  minHeight: "48px",
  transition: "all 0.2s ease",
};

const buttonGroup = {
  display: "flex",
  gap: "var(--space-sm)",
  flexWrap: "wrap",
};

const hint = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  opacity: 0.75,
};

const joinPanel = {
  marginTop: "var(--space-md)",
  padding: "var(--space-md)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-secondary)",
};

const emptyJoin = {
  color: "var(--text-tertiary)",
  fontSize: "var(--text-sm)",
  opacity: 0.8,
};

const roomInfo = {
  lineHeight: 1.8,
  marginBottom: "var(--space-md)",
};

const roomCodeRow = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-sm)",
  marginBottom: "var(--space-xs)",
};

const label = {
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const mono = {
  fontFamily: "var(--font-mono)",
  background: "var(--bg-tertiary)",
  padding: "4px 8px",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--accent-primary)",
};

const hostBadge = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "var(--radius-full)",
  background: "var(--accent-glow)",
  border: "1px solid var(--accent-border)",
  color: "var(--accent-primary)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  marginTop: "var(--space-xs)",
  marginBottom: "var(--space-xs)",
};

const homeCard = {
  ...card,
  width: "100%",
  maxWidth: "500px",
};
