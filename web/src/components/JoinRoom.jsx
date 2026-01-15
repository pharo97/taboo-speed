// web/src/components/JoinRoom.jsx
import { useState } from "react";

export default function JoinRoom({ onJoin, disabled }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [name, setName] = useState("");

  function submit(e) {
    e.preventDefault();
    if (disabled) return;

    const rc = roomCodeInput.trim().toUpperCase();
    const nm = name.trim();

    if (!rc) return;

    onJoin({ roomCodeInput: rc, name: nm || "Player" });

    // keep room code so they can retry quickly
    setName("");
  }

  return (
    <div style={card}>
      <h3 style={title}>Join Game</h3>

      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        <input
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          placeholder="Room Code (e.g. TF8QGR)"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!!disabled}
          style={input}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name (optional)"
          disabled={!!disabled}
          style={input}
        />

        <button type="submit" disabled={!!disabled} style={btnPrimary}>
          Join
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          One code. One job. Humans will still mess it up.
        </div>
      </form>
    </div>
  );
}

const card = {
  border: "1px solid #333",
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
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
