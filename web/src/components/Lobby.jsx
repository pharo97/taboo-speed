// src/components/Lobby.jsx
import { useState } from "react";

export default function Lobby({
  inRoom,
  isHost,
  roomCode,
  roomStatus,
  roomPassword, // may be undefined for non-host or if sanitizeRoom hides it
  onCreateRoom,
  onLeaveRoom,
  joinForm, // pass <JoinRoom .../> here to render inside Lobby
}) {
  const [showJoin, setShowJoin] = useState(false);

  // HOME (not in a room)
  if (!inRoom) {
    return (
      <div style={card}>
        <h3 style={title}>Lobby</h3>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btnPrimary} onClick={onCreateRoom}>
            Create Game
          </button>

          <button
            style={btn}
            onClick={() => setShowJoin((v) => !v)}
            aria-expanded={showJoin}
            aria-controls="join-panel"
          >
            {showJoin ? "Close Join" : "Join Game"}
          </button>
        </div>

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

        {isHost && (
          <div>
            <strong>password:</strong>{" "}
            <span style={mono}>
              {roomPassword || "(hidden / not provided)"}
            </span>
          </div>
        )}
      </div>

      <div
        style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}
      >
        <button
          style={btnDanger}
          onClick={() => {
            // optional: reset the join toggle so when user returns home it starts closed
            setShowJoin(false);
            onLeaveRoom?.();
          }}
        >
          Leave Game
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Tip: share <span style={mono}>{roomCode}</span>
        {isHost && roomPassword ? (
          <>
            {" "}
            + <span style={mono}>{roomPassword}</span>
          </>
        ) : null}{" "}
        with friends.
      </div>
    </div>
  );
}

const card = {
  border: "1px solid #ddd",
  padding: 12,
  borderRadius: 10,
  marginBottom: 12,
};

const title = { marginTop: 0, marginBottom: 10 };

const btn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #bbb",
  background: "white",
  cursor: "pointer",
};

const btnPrimary = {
  ...btn,
  border: "1px solid #333",
  fontWeight: 600,
};

const btnDanger = {
  ...btn,
  border: "1px solid #a00",
  color: "#a00",
  fontWeight: 600,
};

const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
