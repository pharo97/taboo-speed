// web/src/components/Lobby.jsx
import { useState } from "react";

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
    // optional: keep it or clear it
    // setHostName("");
  }

  // HOME
  if (!inRoom) {
    return (
      <div style={card}>
        <h3 style={title}>Lobby</h3>

        <form onSubmit={handleCreate} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Your name (host)"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            style={input}
            maxLength={40}
            autoComplete="off"
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={btnPrimary}
              type="submit"
              disabled={!hostName.trim()}
            >
              Create Game
            </button>

            <button
              style={btn}
              type="button"
              onClick={() => setShowJoin((v) => !v)}
              aria-expanded={showJoin}
              aria-controls="join-panel"
            >
              {showJoin ? "Close Join" : "Join Game"}
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Pick a name. It’s not a personality test.
          </div>
        </form>

        {showJoin && (
          <div id="join-panel" style={{ marginTop: 12 }}>
            {joinForm ? (
              joinForm
            ) : (
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Join form not passed into Lobby yet.
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
      <h3 style={title}>Lobby</h3>

      <div style={{ lineHeight: 1.6 }}>
        <div>
          <strong>roomCode:</strong> <span style={mono}>{roomCode || "-"}</span>
        </div>
        <div>
          <strong>status:</strong> {roomStatus || "-"}
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Share the <span style={mono}>{roomCode}</span> with friends.
          {isHost ? " You’re host, congrats." : null}
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}
      >
        <button
          style={btnDanger}
          onClick={() => {
            setShowJoin(false);
            onLeaveRoom?.();
          }}
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}

const card = {
  border: "1px solid #333",
  padding: 12,
  borderRadius: 10,
  marginBottom: 12,
  background: "#1a1a1a",
  color: "#fff",
};

const title = { marginTop: 0, marginBottom: 10, color: "#fff" };

const input = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  outline: "none",
  fontSize: 16,
  minHeight: 44,
};

const btn = {
  padding: "12px 16px",
  borderRadius: 8,
  border: "1px solid #555",
  background: "#2a2a2a",
  color: "#fff",
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 14,
  minHeight: 44,
};

const btnPrimary = {
  ...btn,
  border: "1px solid #fff",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
};

const btnDanger = {
  ...btn,
  border: "1px solid #ef4444",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 600,
};

const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#0a0a0a",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 13,
};
